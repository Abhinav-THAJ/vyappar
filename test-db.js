const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany();
  console.log("SUCCESS! Users count:", users.length);
}
main().catch(e => {
  console.error("FAILED TO CONNECT:");
  console.error(e);
}).finally(() => prisma.$disconnect());
