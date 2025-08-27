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
    
    // レスポンスの詳細をデバッグ出力
    console.log(`🔍 [${index}] Response structure:`, {
      hasResponse: !!response,
      hasCandidates: !!response.candidates,
      candidatesType: typeof response.candidates,
      candidatesIsArray: Array.isArray(response.candidates),
      candidatesLength: response.candidates?.length || 0
    });
    
    // response.candidatesが存在しない場合の詳細エラー
    if (!response.candidates) {
      console.error(`❌ [${index}] No candidates in response. Full response:`, JSON.stringify(response, null, 2));
      
      // テキストレスポンスを試みる
      try {
        const text = response.text();
        console.error(`📄 [${index}] Response text:`, text);
      } catch (e) {
        console.error(`❌ [${index}] Could not get text from response:`, e.message);
      }
      return null;
    }
    
    // 画像データを抽出
    let imageGenerated = false;
    for (const candidate of response.candidates) {
      if (!candidate.content || !candidate.content.parts) {
        console.error(`❌ [${index}] Candidate has no content.parts:`, JSON.stringify(candidate, null, 2));
        continue;
      }
      
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
    
    if (!imageGenerated) {
      console.error(`❌ [${index}] No image data found in any candidate`);
      
      // 全candidatesの構造を出力
      response.candidates.forEach((cand, i) => {
        console.error(`[${index}] Candidate ${i}:`, JSON.stringify(cand, null, 2));
      });
    }
    
    return null;
    
  } catch (error) {
    console.error(`❌ [${index}] Error:`, error.message);
    console.error(`📊 [${index}] Error stack:`, error.stack);
    
    // GoogleGenerativeAI特有のエラー情報を出力
    if (error.response) {
      console.error(`📊 [${index}] Error response:`, JSON.stringify(error.response, null, 2));
    }
    if (error.status) {
      console.error(`📊 [${index}] Error status:`, error.status);
    }
    if (error.statusText) {
      console.error(`📊 [${index}] Error statusText:`, error.statusText);
    }
    
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
  const timestamp = Date.now(); // ミリ秒のタイムスタンプを生成
  
  const promises = [];
  for (let i = 1; i <= count; i++) {
    const outputPath = path.join(dirname, `${basename}_generated_${timestamp}_${i}${ext}`);
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