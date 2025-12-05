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
  console.error('エラー: 環境変数にGOOGLE_API_KEYが見つかりません');
  console.error('.envファイルを作成するか、環境変数として設定してください');
  console.error('APIキー取得: https://aistudio.google.com/app/apikey');
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
    console.log(`🎨 [${index}] 画像生成中...`);
    
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
    
    const imagePart = await fileToGenerativePart(imagePath);
    
    const fullPrompt = `Generate an image based on this input image and the following instruction: ${prompt}
    
    IMPORTANT: Create a new image that follows the instruction while using the input image as reference.`;
    
    const result = await model.generateContent([fullPrompt, imagePart]);
    const response = await result.response;
    
    // response.candidatesが存在しない場合の詳細エラー
    if (!response.candidates) {
      console.error(`❌ [${index}] 画像生成失敗 (クォータ制限の可能性があります)`);
      return null;
    }
    
    // 画像データを抽出
    let imageGenerated = false;
    for (const candidate of response.candidates) {
      if (!candidate.content || !candidate.content.parts) {
        console.error(`❌ [${index}] 画像データ形式エラー`);
        continue;
      }
      
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          const imageData = part.inlineData.data;
          const buffer = Buffer.from(imageData, 'base64');
          await fs.writeFile(outputPath, buffer);
          console.log(`✅ [${index}] 画像保存完了: ${outputPath}`);
          imageGenerated = true;
          return outputPath;
        }
      }
      if (imageGenerated) break;
    }
    
    if (!imageGenerated) {
      console.error(`❌ [${index}] 画像データが見つかりません`);
    }
    
    return null;
    
  } catch (error) {
    if (error.status === 429) {
      console.error(`❌ [${index}] クォータ制限: ${error.message}`);
    } else {
      console.error(`❌ [${index}] エラー: ${error.message}`);
    }
    return null;
  }
}

async function generateImages(imagePath, prompt, count) {
  const ext = path.extname(imagePath);
  const basename = path.basename(imagePath, ext);
  const dirname = path.dirname(imagePath);
  
  console.log(`🚀 画像生成開始`);
  console.log(`📁 入力画像: ${imagePath}`);
  console.log(`📝 プロンプト: ${prompt}`);
  console.log(`🔢 生成枚数: ${count}`);
  console.log(`⚡ ${count}枚の画像を並列生成中...\n`);
  
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
  
  console.log(`\n✨ 生成完了！`);
  console.log(`✅ 成功: ${successCount}/${count}枚`);
  console.log(`⏱️  処理時間: ${duration}秒`);
  
  if (successCount === 0) {
    process.exit(1);
  }
}

program
  .name('generate-images')
  .description('Gemini APIを使用してプロンプトベースで複数の画像を生成')
  .version('2.0.0')
  .argument('<image>', '入力画像のパス')
  .argument('<prompt>', '画像生成用のプロンプト')
  .argument('[count]', '生成する画像数', '1')
  .action(async (imagePath, prompt, count) => {
    try {
      await fs.access(imagePath);
    } catch {
      console.error(`❌ エラー: ファイルが見つかりません: ${imagePath}`);
      process.exit(1);
    }
    
    const imageCount = parseInt(count);
    if (isNaN(imageCount) || imageCount < 1) {
      console.error(`❌ エラー: 無効な生成枚数: ${count}`);
      process.exit(1);
    }
    
    await generateImages(imagePath, prompt, imageCount);
  });

program.parse();
