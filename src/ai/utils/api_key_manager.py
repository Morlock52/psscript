"""
API Key Manager

Manages OpenAI API keys with interactive prompts and .env file storage.
"""

import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("api_key_manager")


class APIKeyManager:
    """Manages API keys with secure storage and validation."""

    def __init__(self, env_file: str = ".env"):
        """
        Initialize the API key manager.

        Args:
            env_file: Path to the .env file
        """
        self.env_file = Path(env_file)
        self.env_path = self._find_env_file()

    def _find_env_file(self) -> Path:
        """
        Find the .env file, checking multiple locations.

        Returns:
            Path to .env file
        """
        # Check current directory
        if self.env_file.exists():
            return self.env_file

        # Check parent directories (up to 3 levels)
        current = Path.cwd()
        for _ in range(3):
            env_path = current / self.env_file
            if env_path.exists():
                return env_path
            current = current.parent

        # Check project root (ai service directory)
        project_root = Path(__file__).parent.parent
        env_path = project_root / self.env_file
        if env_path.exists():
            return env_path

        # Return default path in project root
        return project_root / self.env_file

    def get_api_key(self, prompt_if_missing: bool = True) -> Optional[str]:
        """
        Get the OpenAI API key.

        Args:
            prompt_if_missing: If True, prompt user for key if not found

        Returns:
            API key or None
        """
        # Check environment variable first
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            logger.info("OpenAI API key found in environment")
            return api_key

        # Check .env file
        api_key = self._read_key_from_env()
        if api_key:
            logger.info("OpenAI API key found in .env file")
            os.environ["OPENAI_API_KEY"] = api_key
            return api_key

        # Prompt user if enabled
        if prompt_if_missing:
            logger.warning("OpenAI API key not found")
            return self.prompt_for_key()

        return None

    def _read_key_from_env(self) -> Optional[str]:
        """
        Read API key from .env file.

        Returns:
            API key or None
        """
        if not self.env_path.exists():
            return None

        try:
            with open(self.env_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('OPENAI_API_KEY='):
                        key = line.split('=', 1)[1].strip()
                        # Remove quotes if present
                        key = key.strip('"').strip("'")
                        if key:
                            return key
        except Exception as e:
            logger.error(f"Error reading .env file: {e}")

        return None

    def prompt_for_key(self) -> Optional[str]:
        """
        Prompt user to enter API key interactively.

        Returns:
            API key or None
        """
        print("\n" + "="*70)
        print("  OpenAI API Key Not Found")
        print("="*70)
        print("\nTo use the AI features, you need an OpenAI API key.")
        print("\nHow to get an API key:")
        print("  1. Go to: https://platform.openai.com/api-keys")
        print("  2. Sign in or create an account")
        print("  3. Click 'Create new secret key'")
        print("  4. Copy the key (it starts with 'sk-')")
        print("\nYour key will be securely saved to the .env file.")
        print("="*70 + "\n")

        try:
            api_key = input("Enter your OpenAI API key (or press Enter to skip): ").strip()

            if not api_key:
                print("Skipped. AI features will run in mock mode.")
                return None

            # Validate format
            if not self.validate_key_format(api_key):
                print("⚠️  Warning: API key format looks incorrect (should start with 'sk-')")
                confirm = input("Save anyway? (y/n): ").strip().lower()
                if confirm != 'y':
                    return None

            # Save to .env file
            if self.save_key_to_env(api_key):
                print(f"✅ API key saved successfully to: {self.env_path}")
                os.environ["OPENAI_API_KEY"] = api_key
                return api_key
            else:
                print("❌ Failed to save API key")
                return None

        except KeyboardInterrupt:
            print("\n\nSkipped. AI features will run in mock mode.")
            return None
        except Exception as e:
            logger.error(f"Error prompting for API key: {e}")
            return None

    def validate_key_format(self, key: str) -> bool:
        """
        Validate API key format.

        Args:
            key: The API key to validate

        Returns:
            True if format looks valid
        """
        # OpenAI keys typically start with 'sk-' and are ~51 characters
        return key.startswith('sk-') and len(key) > 20

    def save_key_to_env(self, api_key: str) -> bool:
        """
        Save API key to .env file.

        Args:
            api_key: The API key to save

        Returns:
            True if successful
        """
        try:
            # Read existing content
            existing_lines = []
            key_found = False

            if self.env_path.exists():
                with open(self.env_path, 'r') as f:
                    for line in f:
                        if line.strip().startswith('OPENAI_API_KEY='):
                            # Replace existing key
                            existing_lines.append(f'OPENAI_API_KEY={api_key}\n')
                            key_found = True
                        else:
                            existing_lines.append(line)

            # If key wasn't found, add it
            if not key_found:
                existing_lines.append(f'\n# OpenAI API Key\nOPENAI_API_KEY={api_key}\n')

            # Write back to file
            self.env_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.env_path, 'w') as f:
                f.writelines(existing_lines)

            # Set restrictive permissions (owner read/write only)
            os.chmod(self.env_path, 0o600)

            logger.info(f"API key saved to {self.env_path}")
            return True

        except Exception as e:
            logger.error(f"Error saving API key to .env: {e}")
            return False

    def test_key(self, api_key: Optional[str] = None) -> bool:
        """
        Test if API key works by making a simple API call.

        Args:
            api_key: API key to test (uses stored key if None)

        Returns:
            True if key works
        """
        if not api_key:
            api_key = self.get_api_key(prompt_if_missing=False)

        if not api_key:
            return False

        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)

            # Make a minimal API call to test
            client.models.list()
            logger.info("API key validated successfully")
            return True

        except Exception as e:
            logger.error(f"API key validation failed: {e}")
            return False

    def update_key(self):
        """Update the API key interactively."""
        print("\n" + "="*70)
        print("  Update OpenAI API Key")
        print("="*70)

        current_key = self.get_api_key(prompt_if_missing=False)
        if current_key:
            # SECURITY: Only show that a key exists, never show any portion of it
            # Even partial exposure (first/last chars) aids brute-force attacks
            key_length = len(current_key)
            print(f"\nCurrent key: [REDACTED - {key_length} characters]")

        return self.prompt_for_key()

    def remove_key(self):
        """Remove API key from .env file."""
        try:
            if not self.env_path.exists():
                print("No .env file found")
                return

            # Read existing content
            lines = []
            with open(self.env_path, 'r') as f:
                for line in f:
                    if not line.strip().startswith('OPENAI_API_KEY='):
                        lines.append(line)

            # Write back
            with open(self.env_path, 'w') as f:
                f.writelines(lines)

            # Clear environment variable
            if 'OPENAI_API_KEY' in os.environ:
                del os.environ['OPENAI_API_KEY']

            print("✅ API key removed")
            logger.info("API key removed from .env")

        except Exception as e:
            logger.error(f"Error removing API key: {e}")
            print(f"❌ Error removing key: {e}")


# Create singleton instance
api_key_manager = APIKeyManager()


def ensure_api_key() -> Optional[str]:
    """
    Ensure API key is available, prompting if necessary.

    Returns:
        API key or None
    """
    return api_key_manager.get_api_key(prompt_if_missing=True)


if __name__ == "__main__":
    # Command-line interface
    import sys

    manager = APIKeyManager()

    if len(sys.argv) > 1:
        command = sys.argv[1].lower()

        if command == "set":
            manager.prompt_for_key()
        elif command == "test":
            if manager.test_key():
                print("✅ API key is valid")
            else:
                print("❌ API key is invalid or not set")
        elif command == "remove":
            manager.remove_key()
        elif command == "update":
            manager.update_key()
        else:
            print(f"Unknown command: {command}")
            print("Usage: python api_key_manager.py [set|test|remove|update]")
    else:
        # Interactive mode
        key = manager.get_api_key(prompt_if_missing=True)
        if key:
            print(f"\n✅ API key configured: {key[:7]}...{key[-4:]}")
        else:
            print("\n⚠️  No API key configured (running in mock mode)")
