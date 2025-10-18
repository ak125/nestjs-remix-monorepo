#!/usr/bin/env node

import { Command } from 'commander';
import { AIDriver } from '../core/ai-driver';

const program = new Command();

program
  .name('ai-audit')
  .description('Système d\'agents IA pour l\'audit et l\'amélioration du monorepo')
  .version('1.0.0');

program
  .command('all')
  .description('Exécuter tous les agents activés')
  .action(async () => {
    const driver = new AIDriver();
    await driver.executeAll();
  });

program
  .command('agent <type>')
  .description('Exécuter un agent spécifique (cartographe, optimizer, etc.)')
  .action(async (type: string) => {
    const driver = new AIDriver();
    try {
      await driver.executeAgent(type);
    } catch (error) {
      console.error(`❌ Erreur: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('Lister tous les agents disponibles')
  .action(() => {
    const driver = new AIDriver();
    const agents = driver.listAgents();
    
    console.log('\n🤖 Agents disponibles:\n');
    for (const agent of agents) {
      console.log(`  📊 ${agent.name}`);
      console.log(`     Type: ${agent.type}`);
      console.log(`     Description: ${agent.description}\n`);
    }
  });

program.parse(process.argv);
