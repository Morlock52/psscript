#!/usr/bin/env node
require('dotenv').config();
const { program } = require('commander');
const { ChatService } = require('../services');
const { sequelize } = require('../models');
const chalk = require('chalk');
const readline = require('readline');

// Configure CLI
program
  .name('chat')
  .description('CLI tool for chatting with the vector database')
  .version('1.0.0');

// Command to start a chat session
program
  .command('start')
  .description('Start a new chat session')
  .option('-t, --title <title>', 'Conversation title', 'CLI Chat Session')
  .option('-i, --id <id>', 'Use existing conversation ID')
  .action(async (options) => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const chatService = new ChatService();
      let conversation;
      
      if (options.id) {
        try {
          conversation = await chatService.getConversation(options.id);
          console.log(chalk.green(`Continuing conversation: ${conversation.title}`));
        } catch (error) {
          console.error(chalk.red(`Error: Conversation with ID ${options.id} not found.`));
          process.exit(1);
        }
      } else {
        conversation = await chatService.createConversation(options.title);
        console.log(chalk.green(`Created new conversation: ${conversation.title}`));
        console.log(chalk.gray(`Conversation ID: ${conversation.id}`));
      }
      
      // Print previous messages if any
      if (conversation.messages && conversation.messages.length > 1) {
        console.log(chalk.yellow('\nPrevious messages:'));
        
        for (const message of conversation.messages) {
          if (message.role === 'system') continue;
          
          if (message.role === 'user') {
            console.log(chalk.cyan('\nYou: ') + message.content);
          } else {
            console.log(chalk.green('\nAssistant: ') + message.content);
          }
        }
        
        console.log(chalk.yellow('\n---\n'));
      }
      
      // Create readline interface
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('You: ')
      });
      
      console.log(chalk.yellow('Type your message and press Enter. Type "exit" to quit.'));
      rl.prompt();
      
      rl.on('line', async (line) => {
        const input = line.trim();
        
        if (input.toLowerCase() === 'exit') {
          console.log(chalk.yellow('Exiting chat...'));
          await sequelize.close();
          rl.close();
          return;
        }
        
        if (input.length === 0) {
          rl.prompt();
          return;
        }
        
        try {
          console.log(chalk.gray('Thinking...'));
          
          const response = await chatService.sendMessage(conversation.id, input);
          
          console.log(chalk.green('\nAssistant: ') + response.content);
          console.log();
          rl.prompt();
        } catch (error) {
          console.error(chalk.red('Error sending message:'), error.message);
          rl.prompt();
        }
      });
      
      rl.on('close', async () => {
        console.log(chalk.yellow('\nChat session ended.'));
        await sequelize.close();
        process.exit(0);
      });
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command to list conversations
program
  .command('list')
  .description('List all conversations')
  .action(async () => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const { Conversation, Message } = require('../models');
      
      const conversations = await Conversation.findAll({
        attributes: ['id', 'title', 'createdAt', 'updatedAt'],
        order: [['updatedAt', 'DESC']],
        include: [
          {
            model: Message,
            as: 'messages',
            attributes: ['id', 'role', 'createdAt'],
            limit: 1,
            order: [['createdAt', 'DESC']]
          }
        ]
      });
      
      if (conversations.length === 0) {
        console.log(chalk.yellow('No conversations found.'));
      } else {
        console.log(chalk.green(`Found ${conversations.length} conversations:`));
        
        conversations.forEach((conversation, index) => {
          const messageCount = conversation.messages ? conversation.messages.length : 0;
          console.log();
          console.log(chalk.cyan(`${index + 1}. ${conversation.title}`));
          console.log(chalk.gray(`   ID: ${conversation.id}`));
          console.log(chalk.gray(`   Created: ${conversation.createdAt.toLocaleString()}`));
          console.log(chalk.gray(`   Last updated: ${conversation.updatedAt.toLocaleString()}`));
          console.log(chalk.gray(`   Messages: ${messageCount}`));
        });
      }
      
      await sequelize.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command to view a conversation
program
  .command('view')
  .description('View a conversation')
  .argument('<id>', 'Conversation ID')
  .action(async (id) => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const chatService = new ChatService();
      
      try {
        const conversation = await chatService.getConversation(id);
        
        console.log(chalk.green(`Conversation: ${conversation.title}`));
        console.log(chalk.gray(`ID: ${conversation.id}`));
        console.log(chalk.gray(`Created: ${conversation.createdAt.toLocaleString()}`));
        console.log(chalk.gray(`Last updated: ${conversation.updatedAt.toLocaleString()}`));
        console.log();
        
        if (conversation.messages.length <= 1) {
          console.log(chalk.yellow('No messages in this conversation.'));
        } else {
          console.log(chalk.yellow('Messages:'));
          
          for (const message of conversation.messages) {
            if (message.role === 'system') continue;
            
            if (message.role === 'user') {
              console.log(chalk.cyan('\nUser: ') + message.content);
              console.log(chalk.gray(`[${message.createdAt.toLocaleString()}]`));
            } else {
              console.log(chalk.green('\nAssistant: ') + message.content);
              console.log(chalk.gray(`[${message.createdAt.toLocaleString()}]`));
            }
          }
        }
      } catch (error) {
        console.error(chalk.red(`Error: Conversation with ID ${id} not found.`));
      }
      
      await sequelize.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Command to delete a conversation
program
  .command('delete')
  .description('Delete a conversation')
  .argument('<id>', 'Conversation ID')
  .action(async (id) => {
    try {
      await sequelize.authenticate();
      console.log('Connected to database');
      
      const { Conversation } = require('../models');
      
      const conversation = await Conversation.findByPk(id);
      
      if (!conversation) {
        console.error(chalk.red(`Error: Conversation with ID ${id} not found.`));
      } else {
        await conversation.destroy();
        console.log(chalk.green(`Conversation "${conversation.title}" deleted successfully.`));
      }
      
      await sequelize.close();
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
