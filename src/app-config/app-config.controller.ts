import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { UpdateAppConfigDto } from '../dto/update-app-config.dto';
import { PasswordProtected } from '../auth/password-protected.decorator';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  getConfig() {
    return this.appConfigService.getConfig();
  }

  @Patch()
  @PasswordProtected()
  updateConfig(@Body() updateAppConfigDto: UpdateAppConfigDto) {
    return this.appConfigService.updateConfig(updateAppConfigDto);
  }
}
