#!/usr/bin/env node
require('dotenv').config();
const { OpenAIEmbeddings } = require('langchain/embeddings/openai');
const { ChatOpenAI } = require('langchain/chat_models/openai');
const { HumanMessage } = require('langchain/schema');

async function testOpenAI() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY is not set in .env file');
      process.exit(1);
    }
    
    console.log('Testing OpenAI API connection...');
    
    // Test embeddings
    console.log('Testing embeddings...');
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: process.env.EMBEDDING_MODEL || 'text-embedding-ada-002'
    });
    
    const embeddingResult = await embeddings.embedQuery('Hello, world!');
    console.log(`✅ Embeddings API working (vector dimension: ${embeddingResult.length})`);
    
    // Test chat completion
    console.log('Testing chat completion...');
    const chat = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: process.env.LLM_MODEL || 'gpt-4',
      temperature: 0
    });
    
    const response = await chat.call([
      new HumanMessage('Respond with a single word: Hello')
    ]);
    
    console.log(`✅ Chat API working (response: ${response.content})`);
    console.log('All OpenAI API tests passed!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing OpenAI API:', error);
    process.exit(1);
  }
}

// Run the test
testOpenAI();
