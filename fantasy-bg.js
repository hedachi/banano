#!/usr/bin/env node

import { GoogleGenerativeAI } from '@google/generative-ai';
import { program } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  console.error('Error: GOOGLE_API_KEY not found in environment variables.');
  console.error('Please create a .env file with your API key or export it as an environment variable.');
  console.error('Get your API key from: https://aistudio.google.com/app/apikey');
  process.exit(1);
}

async function fileToGenerativePart(imagePath) {
  const imageData = await fs.readFile(imagePath);
  const base64Data = imageData.toString('base64');
  
  const ext = path.extname(imagePath).toLowerCase().slice(1);
  const mimeType = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  }[ext] || 'image/jpeg';
  
  return {
    inlineData: {
      data: base64Data,
      mimeType
    }
  };
}

async function generateFantasyImage(imagePath, outputPath) {
  try {
    console.log('🚀 Starting Fantasy Background Transformer with Gemini 2.5 Flash Image (nano-banana)');
    console.log('🔍 Processing image...');
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
    
    // Load the input image
    const imagePart = await fileToGenerativePart(imagePath);
    
    const prompt = `Transform this image by replacing the entire background with an epic fantasy world. 
    Keep the main subject exactly as it is - same pose, same appearance, same clothing - but place them in a magical fantasy setting. 
    The new background should include:
    - Floating islands or mystical mountains in the distance
    - Magical auroras or ethereal lighting in the sky
    - Fantasy elements like ancient ruins, enchanted forests, or magical crystals
    - Epic atmosphere with dramatic lighting
    - Rich, vibrant colors typical of fantasy worlds
    
    IMPORTANT: Preserve the original subject perfectly while completely replacing the background with a fantasy world.`;
    
    console.log('✨ Generating fantasy version with nano-banana...');
    
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    
    // Extract the generated image
    let imageGenerated = false;
    for (const candidate of response.candidates) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, 'base64');
          await fs.writeFile(outputPath, buffer);
          imageGenerated = true;
          console.log(`\n✅ Fantasy image generated successfully!`);
          console.log(`📁 Saved to: ${outputPath}`);
          break;
        }
      }
      if (imageGenerated) break;
    }
    
    if (!imageGenerated) {
      console.error('❌ No image was generated. The API might have returned text instead.');
      console.log('Response:', response.text());
    }
    
  } catch (error) {
    console.error('❌ Error generating image:', error.message);
    if (error.message.includes('model')) {
      console.error('\n⚠️  Note: The model name might need to be updated.');
      console.error('Trying alternative model names...');
      
      // Try alternative model name
      try {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
        
        const imagePart = await fileToGenerativePart(imagePath);
        
        const prompt = `Generate an image: Transform this photo by replacing the background with a fantasy world setting. 
        Keep the main subject intact but create an epic fantasy background with magical elements.`;
        
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        
        for (const candidate of response.candidates) {
          for (const part of candidate.content.parts) {
            if (part.inlineData) {
              const imageData = part.inlineData.data;
              const buffer = Buffer.from(imageData, 'base64');
              await fs.writeFile(outputPath, buffer);
              console.log(`\n✅ Fantasy image generated with alternative model!`);
              console.log(`📁 Saved to: ${outputPath}`);
              return;
            }
          }
        }
        
        console.log('Response:', response.text());
      } catch (altError) {
        console.error('Alternative model also failed:', altError.message);
      }
    }
    process.exit(1);
  }
}

program
  .name('fantasy-bg')
  .description('Transform image backgrounds into fantasy worlds using Gemini 2.5 Flash Image (nano-banana)')
  .version('1.0.0')
  .argument('<image>', 'Path to the input image')
  .option('-o, --output <path>', 'Output file path (default: input_fantasy.ext)')
  .action(async (imagePath, options) => {
    try {
      await fs.access(imagePath);
    } catch {
      console.error(`❌ Error: File not found: ${imagePath}`);
      process.exit(1);
    }
    
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = options.output || path.join(dirname, `${basename}_fantasy${ext}`);
    
    console.log(`📁 Input: ${imagePath}`);
    console.log(`📁 Output: ${outputPath}`);
    
    await generateFantasyImage(imagePath, outputPath);
  });

program.parse();