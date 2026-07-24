import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.professionalProfile.findFirst({ where: { contactId: 'f691ea67-4941-47b4-a043-df4e948b0597' } })
  .then(res => console.log(JSON.stringify(res, null, 2)))
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
