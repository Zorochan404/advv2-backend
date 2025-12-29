#!/usr/bin/env node

/**
 * Script to clean up conflicting Drizzle migrations
 * Run this before using the production-grade test setup
 */

const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../src/drizzle/migrations');

console.log('🧹 Cleaning up conflicting migrations...');

// Get all migration files
const files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql'));

console.log(`Found ${files.length} migration files:`);
files.forEach(file => console.log(`  - ${file}`));

// Find conflicting 0000_ migrations
const conflictingFiles = files.filter(file => file.startsWith('0000_'));
const nonConflictingFiles = files.filter(file => !file.startsWith('0000_'));

if (conflictingFiles.length > 0) {
  console.log(`\n⚠️  Found ${conflictingFiles.length} conflicting 0000_ migrations:`);
  conflictingFiles.forEach(file => console.log(`  - ${file}`));
  
  console.log('\n📋 Recommended actions:');
  console.log('1. Backup your current migrations:');
  console.log(`   cp -r ${migrationsDir} ${migrationsDir}.backup`);
  
  console.log('\n2. Remove conflicting migrations:');
  conflictingFiles.forEach(file => {
    console.log(`   rm ${path.join(migrationsDir, file)}`);
  });
  
  console.log('\n3. Generate fresh migrations:');
  console.log('   pnpm db:generate');
  
  console.log('\n4. Test the new setup:');
  console.log('   pnpm test');
  
  // Ask for confirmation
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('\n❓ Do you want to proceed with cleanup? (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      console.log('\n🗑️  Removing conflicting migrations...');
      
      conflictingFiles.forEach(file => {
        const filePath = path.join(migrationsDir, file);
        fs.unlinkSync(filePath);
        console.log(`   ✅ Removed ${file}`);
      });
      
      console.log('\n🎉 Cleanup complete!');
      console.log('\n📝 Next steps:');
      console.log('1. Run: pnpm db:generate');
      console.log('2. Run: pnpm test');
      console.log('3. Your tests will now use Drizzle migrations automatically!');
      
    } else {
      console.log('\n⏸️  Cleanup cancelled. You can run this script again later.');
    }
    
    rl.close();
  });
  
} else {
  console.log('\n✅ No conflicting migrations found!');
  console.log('\n📝 Your migrations look good. You can now:');
  console.log('1. Run: pnpm test');
  console.log('2. Tests will use Drizzle migrations automatically');
}

console.log('\n📚 For more info, see: tests/schema-management.md');

