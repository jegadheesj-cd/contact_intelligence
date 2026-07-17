import prisma from '../../config/db';
import { AppError } from '../../utils/AppError';

export class UsersService {
  public async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User profile not found', 404);
    }

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  public async updateProfile(userId: string, data: any) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        organization: data.organization,
        profileImage: data.profileImage,
      },
    });

    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }
}
