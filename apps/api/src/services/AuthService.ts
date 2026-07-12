import { UserRepository } from '../repositories/UserRepository';
import { LoginRequest, RegisterRequest } from '@ion-ai/contracts';
import { hashPassword, verifyPassword } from '@ion-ai/auth';
import { OrganizationService } from './OrganizationService';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private organizationService: OrganizationService
  ) {}

  async register(data: RegisterRequest) {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw Object.assign(new Error('User already exists'), { statusCode: 400 });
    }

    const passwordHash = await hashPassword(data.password);
    const user = await this.userRepository.create({
      email: data.email,
      name: data.name,
      passwordHash,
    });

    await this.organizationService.createOrganization(user.id, {
      name: data.organizationName,
    });

    return { id: user.id, email: user.email, name: user.name };
  }

  async login(data: LoginRequest) {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user || !user.passwordHash) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    const isValid = await verifyPassword(data.password, user.passwordHash);
    if (!isValid) {
      throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    }

    return { id: user.id, email: user.email, name: user.name };
  }
}
