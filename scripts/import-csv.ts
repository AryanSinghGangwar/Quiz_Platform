// CSV Import Script for Questions and Options
// Run with: npx tsx scripts/import-csv.ts <path-to-csv>
//
// CSV Format:
// question_text,option_1,option_2,option_3,option_4,correct_option
// "What is 2+2?","3","4","5","6","2"
//
// Notes:
// - correct_option is the index (1-4) of the correct answer
// - Quotes are optional unless text contains commas

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface CSVRow {
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_option: string; // "1", "2", "3", or "4"
}

/**
 * Simple CSV parser
 * Handles quoted fields and commas within quotes
 */
function parseCSV(content: string): CSVRow[] {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    if (values.length >= 6) {
      rows.push({
        question_text: values[0].replace(/^"|"$/g, ''),
        option_1: values[1].replace(/^"|"$/g, ''),
        option_2: values[2].replace(/^"|"$/g, ''),
        option_3: values[3].replace(/^"|"$/g, ''),
        option_4: values[4].replace(/^"|"$/g, ''),
        correct_option: values[5].replace(/^"|"$/g, ''),
      });
    }
  }

  return rows;
}

/**
 * Import questions and options from CSV
 */
async function importCSV(filePath: string) {
  console.log(`Reading CSV file: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`Parsed ${rows.length} questions from CSV`);

  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    try {
      // Validate correct_option
      const correctIndex = parseInt(row.correct_option);
      if (correctIndex < 1 || correctIndex > 4) {
        console.error(`Invalid correct_option: ${row.correct_option} for question: ${row.question_text.substring(0, 50)}`);
        errorCount++;
        continue;
      }

      // Insert question
      const { data: question, error: qError } = await supabase
        .from('questions')
        .insert([{ question_text: row.question_text }])
        .select()
        .single();

      if (qError || !question) {
        console.error(`Error inserting question: ${qError?.message}`);
        errorCount++;
        continue;
      }

      // Insert options
      const options = [
        { option_text: row.option_1, is_correct: correctIndex === 1 },
        { option_text: row.option_2, is_correct: correctIndex === 2 },
        { option_text: row.option_3, is_correct: correctIndex === 3 },
        { option_text: row.option_4, is_correct: correctIndex === 4 },
      ];

      const { error: oError } = await supabase.from('options').insert(
        options.map(opt => ({
          question_id: question.id,
          option_text: opt.option_text,
          is_correct: opt.is_correct,
        }))
      );

      if (oError) {
        console.error(`Error inserting options: ${oError.message}`);
        errorCount++;
        continue;
      }

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`Imported ${successCount} questions...`);
      }
    } catch (error) {
      console.error(`Unexpected error:`, error);
      errorCount++;
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total: ${rows.length}`);
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npx tsx scripts/import-csv.ts <path-to-csv>');
  console.log('\nExample CSV format:');
  console.log('question_text,option_1,option_2,option_3,option_4,correct_option');
  console.log('"What is 2+2?","3","4","5","6","2"');
  process.exit(1);
}

importCSV(args[0]);