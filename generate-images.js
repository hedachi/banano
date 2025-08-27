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

async function generateSingleImage(imagePath, prompt, outputPath, index) {
  try {
    console.log(`🎨 [${index}] Generating image...`);
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-preview' });
    
    const imagePart = await fileToGenerativePart(imagePath);
    
    const fullPrompt = `Generate an image based on this input image and the following instruction: ${prompt}
    
    IMPORTANT: Create a new image that follows the instruction while using the input image as reference.`;
    
    const result = await model.generateContent([fullPrompt, imagePart]);
    const response = await result.response;
    
    // 画像データを抽出
    let imageGenerated = false;
    for (const candidate of response.candidates) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, 'base64');
          await fs.writeFile(outputPath, buffer);
          console.log(`✅ [${index}] Image saved: ${outputPath}`);
          imageGenerated = true;
          return outputPath;
        }
      }
      if (imageGenerated) break;
    }
    
    // 画像が生成されなかった場合、代替モデルを試す
    if (!imageGenerated) {
      console.log(`⚠️ [${index}] Trying alternative model...`);
      
      const altModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      const altResult = await altModel.generateContent([fullPrompt, imagePart]);
      const altResponse = await altResult.response;
      
      for (const candidate of altResponse.candidates) {
        for (const part of candidate.content.parts) {
          if (part.inlineData) {
            const imageData = part.inlineData.data;
            const buffer = Buffer.from(imageData, 'base64');
            await fs.writeFile(outputPath, buffer);
            console.log(`✅ [${index}] Image saved with alternative model: ${outputPath}`);
            return outputPath;
          }
        }
      }
    }
    
    console.error(`❌ [${index}] No image generated`);
    return null;
    
  } catch (error) {
    console.error(`❌ [${index}] Error:`, error.message);
    return null;
  }
}

async function generateImages(imagePath, prompt, count) {
  const ext = path.extname(imagePath);
  const basename = path.basename(imagePath, ext);
  const dirname = path.dirname(imagePath);
  
  console.log(`🚀 Starting image generation`);
  console.log(`📁 Source image: ${imagePath}`);
  console.log(`📝 Prompt: ${prompt}`);
  console.log(`🔢 Number of images: ${count}`);
  console.log(`⚡ Running ${count} generations in parallel...\n`);
  
  const startTime = Date.now();
  
  const promises = [];
  for (let i = 1; i <= count; i++) {
    const outputPath = path.join(dirname, `${basename}_generated_${i}${ext}`);
    promises.push(generateSingleImage(imagePath, prompt, outputPath, i));
  }
  
  const results = await Promise.all(promises);
  
  const successCount = results.filter(r => r !== null).length;
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log(`\n✨ Generation complete!`);
  console.log(`✅ Successfully generated: ${successCount}/${count} images`);
  console.log(`⏱️  Total time: ${duration} seconds`);
  
  if (successCount === 0) {
    process.exit(1);
  }
}

program
  .name('generate-images')
  .description('Generate multiple images based on a prompt using Gemini API')
  .version('2.0.0')
  .argument('<image>', 'Path to the input image')
  .argument('<prompt>', 'Prompt for image generation')
  .argument('[count]', 'Number of images to generate', '10')
  .action(async (imagePath, prompt, count) => {
    try {
      await fs.access(imagePath);
    } catch {
      console.error(`❌ Error: File not found: ${imagePath}`);
      process.exit(1);
    }
    
    const imageCount = parseInt(count);
    if (isNaN(imageCount) || imageCount < 1) {
      console.error(`❌ Error: Invalid count: ${count}`);
      process.exit(1);
    }
    
    await generateImages(imagePath, prompt, imageCount);
  });

program.parse();