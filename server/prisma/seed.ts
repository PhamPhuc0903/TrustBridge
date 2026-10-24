import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../src/demo.seed';
const db=new PrismaClient();
seedDatabase(db).then(()=>console.log('TrustBridge demo database seeded.')).catch(err=>{
  console.error(err);process.exitCode=1;
}).finally(()=>db.$disconnect());
