import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, ArrayMaxSize, ArrayMinSize, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
export class PitchDto {
  @ApiProperty({example:'F&B / Đồ uống'}) @IsString() @MinLength(2) @MaxLength(100) industry!: string;
  @ApiProperty({example:['fnb','beverage'],type:[String]}) @IsArray() @ArrayMaxSize(8) @IsString({each:true}) industry_tags!: string[];
  @ApiProperty({example:150000}) @IsInt() @Min(1) @Max(100000000) target_usd!: number;
  @ApiProperty({example:15}) @IsInt() @Min(1) @Max(100) equity_percent!: number;
  @ApiProperty({example:'Kombucha TeaLab'}) @IsString() @MinLength(2) @MaxLength(150) brand_name!: string;
  @ApiProperty({example:'Nguyễn Thu An'}) @IsString() @MinLength(2) @MaxLength(150) founder_name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) secret?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(3000) private_details?: string;
}
export class ProgressDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(2000) content!: string;
}
export class DecisionDto {
  @ApiProperty({enum:['APPROVE','REJECT']}) @IsIn(['APPROVE','REJECT']) action!: 'APPROVE' | 'REJECT';
  @ApiPropertyOptional({default:false}) @IsOptional() @IsBoolean() acknowledge_conflict?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(600) note?: string;
}
export class EvidenceDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(2000) evidence!: string;
}
export class MilestoneDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(255) target!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100) allocation_percent!: number;
}
export class DealDto {
  @ApiProperty() @IsString() pitch_id!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(100000000) committed_usd!: number;
  @ApiProperty({type:[MilestoneDto]}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @ValidateNested({each:true}) @Type(()=>MilestoneDto) milestones!: MilestoneDto[];
}
