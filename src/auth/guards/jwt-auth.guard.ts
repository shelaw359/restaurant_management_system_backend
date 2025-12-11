// src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    console.log('🛡️ [JwtAuthGuard] Checking authentication...');
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    console.log('🛡️ [JwtAuthGuard] handleRequest() called');
    console.log('📊 Auth results:', { 
      hasError: !!err, 
      errorMessage: err?.message,
      hasUser: !!user, 
      info: info?.message 
    });
    
    if (err || !user) {
      console.error('❌ Authentication failed!');
      if (err) console.error('Error details:', err);
      if (info) console.error('Info details:', info);
      throw err || new UnauthorizedException('Authentication failed');
    }
    
    console.log('✅ Authentication successful for user:', user.sub);
    return user;
  }
}