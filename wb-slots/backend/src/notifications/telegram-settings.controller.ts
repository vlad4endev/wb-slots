import { Controller, Get, Post, Put, Delete, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TelegramSettingsService, TelegramSettings } from './telegram-settings.service';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    sub: string;
    email: string;
  };
}

@ApiTags('Telegram Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications/telegram/settings')
export class TelegramSettingsController {
  constructor(private telegramSettingsService: TelegramSettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Get Telegram notification settings for current user' })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSettings(@Request() req: AuthenticatedRequest) {
    const settings = await this.telegramSettingsService.getSettings(req.user.sub);
    
    return {
      success: true,
      data: {
        settings,
      },
    };
  }

  @Put()
  @ApiOperation({ summary: 'Update Telegram notification settings for current user' })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid settings data' })
  async updateSettings(
    @Request() req: AuthenticatedRequest,
    @Body() settings: Partial<TelegramSettings>
  ) {
    const success = await this.telegramSettingsService.saveSettings(req.user.sub, settings);
    
    if (success) {
      return {
        success: true,
        data: {
          message: 'Settings updated successfully',
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to update settings',
      };
    }
  }

  @Post('register')
  @ApiOperation({ summary: 'Register user for Telegram notifications' })
  @ApiResponse({ status: 200, description: 'User registered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  async registerUser(
    @Request() req: AuthenticatedRequest,
    @Body() body: {
      chatId: number;
      username?: string;
      firstName?: string;
      lastName?: string;
    }
  ) {
    const { chatId, username, firstName, lastName } = body;
    
    if (!chatId) {
      return {
        success: false,
        error: 'Chat ID is required',
      };
    }

    const success = await this.telegramSettingsService.updateRegistration(
      req.user.sub,
      chatId,
      username,
      firstName,
      lastName
    );

    if (success) {
      return {
        success: true,
        data: {
          message: 'User registered for Telegram notifications',
          chatId,
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to register user',
      };
    }
  }

  @Delete('unregister')
  @ApiOperation({ summary: 'Unregister user from Telegram notifications' })
  @ApiResponse({ status: 200, description: 'User unregistered successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unregisterUser(@Request() req: AuthenticatedRequest) {
    const success = await this.telegramSettingsService.disableNotifications(req.user.sub);
    
    if (success) {
      return {
        success: true,
        data: {
          message: 'User unregistered from Telegram notifications',
        },
      };
    } else {
      return {
        success: false,
        error: 'Failed to unregister user',
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get Telegram notification statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Request() req: AuthenticatedRequest) {
    const stats = await this.telegramSettingsService.getStats();
    
    return {
      success: true,
      data: {
        stats,
      },
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with Telegram settings (admin only)' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAllUsers(@Request() req: AuthenticatedRequest) {
    // TODO: Add admin role check
    const users = await this.telegramSettingsService.getAllUsers();
    
    return {
      success: true,
      data: {
        users,
      },
    };
  }
}
