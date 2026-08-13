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
    let user = await this.userRepository.findByEmail(data.email);

    if (user) {
      // Existing user account -> Verify password before attaching new organization
      if (user.passwordHash) {
        const isValid = await verifyPassword(data.password, user.passwordHash);
        if (!isValid) {
          throw Object.assign(new Error('Incorrect password for existing user account.'), {
            statusCode: 400,
          });
        }
      } else {
        // Set password if hash missing
        const newHash = await hashPassword(data.password);
        await this.userRepository.update(user.id, { passwordHash: newHash });
      }
    } else {
      // New user account -> Create user record in DB
      const passwordHash = await hashPassword(data.password);
      user = await this.userRepository.create({
        email: data.email,
        name: data.name,
        passwordHash,
      });
    }

    // Create organization and attach user as OWNER
    await this.organizationService.createOrganization(user.id, {
      name: data.organizationName,
    });

    return { id: user.id, email: user.email, name: user.name || data.name };
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

  async getUserById(id: string) {
    const user = await this.userRepository.findById(id);
    if (!user) return null;
    return { id: user.id, email: user.email, name: user.name };
  }

  async updateProfile(id: string, data: { name?: string }) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    const updated = await this.userRepository.update(id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
    });
    return { id: updated.id, email: updated.email, name: updated.name };
  }
}
