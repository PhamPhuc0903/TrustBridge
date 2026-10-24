import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { Request } from 'express';
import { ACCOUNTS } from './demo.seed';
import { PrismaService } from './prisma.service';
import { AuthGuard, CurrentUser } from './auth';
import { TrustbridgeService } from './trustbridge.service';
import { PitchDto, ProgressDto, DecisionDto, DealDto, EvidenceDto } from './dto';

@ApiTags('System')
@Controller('api/v1')
export class HealthController {
  constructor(private readonly db: PrismaService) {}
  @Get('ready') async ready() {
    await this.db.$queryRaw`SELECT 1`;
    return {status:'ready',database:'POSTGRESQL',mode:'CLASS_DEMO'};
  }
  @Get('health') health() {return {status:'ok',mode:'CLASS_DEMO',stack:'NESTJS_POSTGRES_PRISMA',ai:process.env.AI_MODE==='http'?'HTTP':'MOCK',escrow:'SIMULATOR'};}
  // Demo-only convenience; credentials must be removed before any external deployment.
  @Get('demo/accounts') accounts() {return ACCOUNTS.map(a=>({...a,password:'Demo123!'}));}
}

@ApiTags('Pitches, Access, Deals')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/v1')
export class TrustbridgeController {
  constructor(private readonly service:TrustbridgeService) {}
  @Get('pitches/feed') feed(@CurrentUser() user:User) {return this.service.feed(user);}
  @Get('startups/me/pitches') mine(@CurrentUser() user:User) {return this.service.myPitches(user);}
  @Post('pitches') createPitch(@Body() body:PitchDto,@CurrentUser() user:User) {return this.service.createPitch(body,user);}
  @Patch('pitches/:id') editPitch(@Param('id') id:string,@Body() body:PitchDto,@CurrentUser() user:User) {return this.service.editPitch(id,body,user);}
  @Post('pitches/:id/demo-pay') pay(@Param('id') id:string,@CurrentUser() user:User) {return this.service.demoPay(id,user);}
  @Post('pitches/:id/submit') submit(@Param('id') id:string,@CurrentUser() user:User) {return this.service.submitPitch(id,user);}
  @Post('pitches/:id/progress-updates') progress(@Param('id') id:string,@Body() body:ProgressDto,@CurrentUser() user:User) {return this.service.addProgress(id,body,user);}
  @Get('pitches/:id/progress-updates') progressHistory(@Param('id') id:string,@CurrentUser() user:User) {return this.service.progressHistory(id,user);}
  @Get('pitches/:id/details') details(@Param('id') id:string,@CurrentUser() user:User) {return this.service.privateDetails(id,user);}
  @Post('pitches/:id/access-requests') request(@Param('id') id:string,@CurrentUser() user:User) {return this.service.requestAccess(id,user);}
  @Get('startups/me/access-requests') incoming(@CurrentUser() user:User) {return this.service.incoming(user);}
  @Post('access-requests/:id/decision') decide(@Param('id',ParseIntPipe) id:number,@Body() body:DecisionDto,@CurrentUser() user:User) {return this.service.decide(id,body,user);}
  @Get('deals') deals(@CurrentUser() user:User) {return this.service.deals(user);}
  @Post('deals') createDeal(@Body() body:DealDto,@CurrentUser() user:User) {return this.service.createDeal(body,user);}
  @Get('deals/:id') deal(@Param('id') id:string,@CurrentUser() user:User) {return this.service.deal(id,user);}
  @Post('milestones/:id/evidence') evidence(@Param('id',ParseIntPipe) id:number,@Body() body:EvidenceDto,@CurrentUser() user:User) {return this.service.evidence(id,body,user);}
  @Post('milestones/:id/approve-and-release') release(@Param('id',ParseIntPipe) id:number,@CurrentUser() user:User) {return this.service.release(id,user);}
  @Get('admin/audit') audit(@CurrentUser() user:User) {return this.service.adminAudit(user);}
}

@ApiTags('Demo maintenance')
@UseGuards(AuthGuard)
@ApiBearerAuth()
@Controller('api/v1')
export class DemoController {
  constructor(private readonly service:TrustbridgeService) {}
  @Post('demo/reset') reset(@CurrentUser() user:User,@Req() req:Request) {
    const ip=req.ip || req.socket.remoteAddress || '';
    if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)) throw new ForbiddenException('Demo reset chỉ khả dụng trên localhost');
    return this.service.reset(user);
  }
}
