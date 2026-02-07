import { Model, DataTypes, Sequelize } from 'sequelize';
import bcrypt from 'bcrypt';
import logger from '../utils/logger';
import { getAuthConfig } from '../utils/envValidation';

// Get bcrypt rounds from environment config (default 12 per OWASP recommendations)
const getBcryptRounds = (): number => {
  try {
    const config = getAuthConfig();
    return config.bcryptRounds;
  } catch {
    // Fallback if config not available during initialization
    return parseInt(process.env.BCRYPT_ROUNDS || '12');
  }
};

export default class User extends Model {
  public id!: number;
  public username!: string;
  public email!: string;
  public password!: string;
  public role!: string;
  public lastLoginAt?: Date;
  public loginAttempts?: number;
  public lockedUntil?: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /**
   * Check if the account is currently locked
   */
  public isLocked(): boolean {
    if (!this.lockedUntil) return false;
    return new Date() < new Date(this.lockedUntil);
  }

  /**
   * Get remaining lockout time in seconds
   */
  public getLockoutRemaining(): number {
    if (!this.lockedUntil) return 0;
    const remaining = new Date(this.lockedUntil).getTime() - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  /**
   * Validate a password against the stored hash
   * @param password The plaintext password to validate
   * @param requestId Optional request ID for logging
   * @returns Promise<boolean> True if password is valid
   */
  public async validatePassword(password: string, requestId?: string): Promise<boolean> {
    const startTime = Date.now();
    
    if (!password) {
      logger.warn('Password validation failed: Empty password provided', {
        userId: this.id,
        username: this.username,
        requestId
      });
      return false;
    }
    
    try {
      // Use bcrypt to compare the provided password with the stored hashed password
      const isValid = await bcrypt.compare(password, this.password);
      
      const processingTime = Date.now() - startTime;
      
      if (isValid) {
        logger.debug('Password validation successful', {
          userId: this.id,
          username: this.username,
          processingTime,
          requestId
        });
      } else {
        logger.warn('Password validation failed: Invalid password', {
          userId: this.id,
          username: this.username,
          processingTime,
          requestId
        });
      }
      
      return isValid;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logger.error('Password validation error:', {
        userId: this.id,
        username: this.username,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime,
        requestId
      });
      
      return false;
    }
  }
  
  /**
   * Update the last login timestamp for this user
   * @param requestId Optional request ID for logging
   */
  public async updateLoginTimestamp(requestId?: string): Promise<void> {
    try {
      this.lastLoginAt = new Date();
      await this.save();
      
      logger.debug('Updated user login timestamp', {
        userId: this.id,
        username: this.username,
        lastLoginAt: this.lastLoginAt,
        requestId
      });
    } catch (error) {
      logger.error('Failed to update login timestamp:', {
        userId: this.id,
        username: this.username,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
    }
  }
  
  /**
   * Track login attempts for this user and implement account lockout
   * @param success Whether the login attempt was successful
   * @param requestId Optional request ID for logging
   * @returns true if account is now locked
   */
  public async trackLoginAttempt(success: boolean, requestId?: string): Promise<boolean> {
    try {
      const config = getAuthConfig();
      const maxAttempts = config.accountLockoutAttempts;
      const lockoutMinutes = config.accountLockoutDurationMinutes;

      // Initialize login attempts if not set
      if (this.loginAttempts === undefined) {
        this.loginAttempts = 0;
      }

      if (success) {
        // Reset login attempts and lockout on successful login
        this.loginAttempts = 0;
        this.lockedUntil = null;
        await this.updateLoginTimestamp(requestId);
        await this.save();

        logger.debug('Tracked successful login attempt', {
          userId: this.id,
          username: this.username,
          requestId
        });
        return false;
      }

      // Increment login attempts on failed login
      this.loginAttempts += 1;

      // Check if account should be locked
      if (this.loginAttempts >= maxAttempts) {
        this.lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);

        logger.warn('Account locked due to excessive failed login attempts', {
          userId: this.id,
          username: this.username,
          loginAttempts: this.loginAttempts,
          lockedUntil: this.lockedUntil,
          lockoutMinutes,
          requestId
        });

        await this.save();
        return true;
      }

      await this.save();

      logger.debug('Tracked failed login attempt', {
        userId: this.id,
        username: this.username,
        loginAttempts: this.loginAttempts,
        maxAttempts,
        attemptsRemaining: maxAttempts - this.loginAttempts,
        requestId
      });

      return false;
    } catch (error) {
      logger.error('Failed to track login attempt:', {
        userId: this.id,
        username: this.username,
        success,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      return false;
    }
  }

  static initialize(sequelize: Sequelize) {
    User.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true
        }
      },
      password: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'password_hash'
      },
      role: {
        type: DataTypes.STRING(20),
        defaultValue: 'user'
      },
      lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_login_at'
      },
      loginAttempts: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: 'login_attempts'
      },
      lockedUntil: {
        type: DataTypes.DATE,
        allowNull: true,
        // DB column is `locked_until` (see src/db/schema.sql + migrations/add_account_lockout.sql)
        field: 'locked_until'
      }
    }, { 
      sequelize,
      tableName: 'users',
      underscored: true,
      hooks: {
        beforeCreate: async (user: User) => {
          try {
            const rounds = getBcryptRounds();
            const salt = await bcrypt.genSalt(rounds);
            user.password = await bcrypt.hash(user.password, salt);
            logger.debug('User password hashed for new user', {
              username: user.username,
              email: user.email,
              bcryptRounds: rounds
            });
          } catch (error) {
            logger.error('Error hashing password during user creation:', {
              username: user.username,
              email: user.email,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
          }
        },
        beforeUpdate: async (user: User) => {
          if (user.changed('password')) {
            try {
              const rounds = getBcryptRounds();
              const salt = await bcrypt.genSalt(rounds);
              user.password = await bcrypt.hash(user.password, salt);
              logger.debug('User password updated and hashed', {
                userId: user.id,
                username: user.username
              });
            } catch (error) {
              logger.error('Error hashing password during user update:', {
                userId: user.id,
                username: user.username,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
              throw error;
            }
          }
        },
        afterCreate: (user: User) => {
          logger.info('New user created', {
            userId: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          });
        },
        afterUpdate: (user: User) => {
          const changedFields = user.changed();
          if (changedFields && changedFields.length > 0) {
            logger.info('User updated', {
              userId: user.id,
              username: user.username,
              changedFields: changedFields.filter(field => field !== 'password')
            });
          }
        }
      }
    });
  }
}
