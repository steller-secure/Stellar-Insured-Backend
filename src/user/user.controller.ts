import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { UserService } from './user.service';
import { UserParamsDto, userParamsSchema } from './dto/user-params.dto';
import { WalletAddressDto, walletAddressSchema } from './dto/wallet-address.dto';
import { UpdateUserDto, updateUserSchema } from './dto/update-user.dto';
import { sanitizeObject } from '../common/utils/sanitization.util';
import { SerializationTransformer } from '../common/utils/serialization.util';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@ApiTags('Users')
@ApiBearerAuth()
@SkipThrottle({ auth: true })
@Controller({ path: 'user', version: '1' })
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 users list requests per minute
  @Get()
  @ApiOperation({ summary: 'List users with pagination' })
  @ApiOkResponse({ description: 'A paginated collection of users' })
  @ApiQuery({ name: 'page', type: Number, required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', type: Number, required: false, description: 'Number of users per page' })
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ) {
    return this.userService.findPaginated(page, limit);
  }

  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 user lookups per minute
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a user by ID' })
  @ApiParam({ name: 'id', type: String, description: 'User ID' })
  @ApiOkResponse({ description: 'User data for the requested ID' })
  async getUser(@Param(new ZodValidationPipe(userParamsSchema)) params: UserParamsDto) {
    const user = await this.userService.findById(params.id);
    return this.mapUserResponse(user);
  }

  @Throttle({ default: { limit: 100, ttl: 60000 } }) // 100 wallet lookups per minute
  @Get('wallet/:address')
  @ApiOperation({ summary: 'Retrieve a user by wallet address' })
  @ApiParam({ name: 'address', type: String, description: 'Wallet address to search by' })
  @ApiOkResponse({ description: 'User data associated with the wallet address' })
  async getUserByWallet(@Param(new ZodValidationPipe(walletAddressSchema)) params: WalletAddressDto) {
    const user = await this.userService.findByWallet(params.address);
    return this.mapUserResponse(user);
  }

  @Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 updates per hour per user
  @Patch(':id')
  @ApiOperation({ summary: 'Update a user profile' })
  @ApiParam({ name: 'id', type: String, description: 'ID of the user to update' })
  @ApiOkResponse({ description: 'Updated user data' })
  async updateUser(
    @Param(new ZodValidationPipe(userParamsSchema)) params: UserParamsDto,
    @Body(new ZodValidationPipe(updateUserSchema)) updateData: UpdateUserDto,
  ) {
    const user = await this.userService.update(params.id, updateData);
    return this.mapUserResponse(user);
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 deletions per hour per user
  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a user' })
  @ApiParam({ name: 'id', type: String, description: 'ID of the user to delete' })
  @ApiOkResponse({ description: 'Deletion result' })
  async deleteUser(@Param(new ZodValidationPipe(userParamsSchema)) params: UserParamsDto) {
    const result = await this.userService.delete(params.id);
    return {
      success: true,
      ...result,
    };
  }

  private mapUserResponse(user: any) {
    return SerializationTransformer.transform({
      id: user.id,
      walletAddress: user.walletAddress,
      reputationScore: user.reputationScore,
      trustScore: user.trustScore,
      email: user.email,
      profileData: user.profileData ? sanitizeObject(user.profileData) : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
