import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log("Users in DB:", users);

    if (users.length === 0) {
        console.log("No users found! Creating default user...");
        await prisma.user.create({
            data: {
                id: 'cm623b0u0000008jy2swc678a', // standard test ID or default ID
                email: 'test@example.com',
                password: 'dummy',
                fullName: 'Test User',
                organization: 'Cloud Destinations'
            }
        });
        console.log("Default user created.");
    }
}
main().finally(() => prisma.$disconnect());
