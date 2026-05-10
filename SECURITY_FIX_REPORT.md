# Security Fix Report

This report details the security vulnerabilities that have been addressed based on the findings of the recent security audit. 

## Critical Vulnerabilities

### 1. Authentication Bypass in `PasswordResetController`

*   **Vulnerability:** The `reset/initiate`, `reset/verify-otp`, and `reset/complete` endpoints were missing the `@Public()` decorator, making them inaccessible to unauthenticated users and breaking the password reset flow.
*   **Fix:** Added the `@Public()` decorator to the affected endpoints in `lms-api-suraksha-lk/src/auth/controllers/password-reset.controller.ts`.

    ```typescript
    // src/auth/controllers/password-reset.controller.ts
    
    @Post('reset/initiate')
    @Public()
    @Throttle({ default: { limit: 3, ttl: 900000 } }) // 🔒 SECURITY: 3 password reset requests per 15 minutes
    @HttpCode(HttpStatus.OK)
    async initiatePasswordReset(
      // ...
    ) { ... }
    
    @Post('reset/verify-otp')
    @Public()
    @Throttle({ default: { limit: 5, ttl: 900000 } }) // 🔒 SECURITY: 5 OTP verification attempts per 15 minutes
    @HttpCode(HttpStatus.OK)
    async verifyPasswordResetOtp(
      // ...
    ) { ... }
    
    @Post('reset/complete')
    @Public()
    @Throttle({ default: { limit: 3, ttl: 900000 } }) // 🔒 SECURITY: 3 password reset completion attempts per 15 minutes
    @HttpCode(HttpStatus.OK)
    async resetPassword(
      // ...
    ) { ... }
    ```

### 2. Authentication Bypass in `BookhireOwnerAuthController`

*   **Vulnerability:** The `register` and `login` endpoints were missing the `@Public()` decorator, preventing new book hire owners from registering and existing owners from logging in.
*   **Fix:** Added the `@Public()` decorator to the affected endpoints in `lms-api-suraksha-lk/src/modules/private-transportation/controllers/bookhire-owner.controller.ts`.

    ```typescript
    // src/modules/private-transportation/controllers/bookhire-owner.controller.ts
    
    @Post('register')
    @Public()
    @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
    async register(@Body() createBookhireOwnerDto: CreateBookhireOwnerDto) {
      // ...
    }
    
    @Post('login')
    @Public()
    @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: BookhireOwnerLoginDto) {
      // ...
    }
    ```

## High-Severity Vulnerabilities

### 1. Debug Endpoint Relying on `NODE_ENV` Check

*   **Vulnerability:** The `debug-user/:email` endpoint in `auth.controller.ts` was protected only by a `NODE_ENV` check, which could be misconfigured and expose the endpoint in a production environment.
*   **Fix:** Removed the entire `debug-user/:email` endpoint from `lms-api-suraksha-lk/src/auth/auth.controller.ts` to eliminate the risk of exposure.

## Medium-Severity Vulnerabilities

### 1. Fragile Password Exclusion in `BookhireOwnerService`

*   **Vulnerability:** The `register` and `login` methods in `bookhire-owner.service.ts` used `delete ownerObject.password` to manually remove the password from the response. This is a fragile pattern that is prone to error.
*   **Fix:** Confirmed that the `password` column in the `BookhireOwnerEntity` is already configured with `select: false`, which is the correct and more robust way to prevent the password from being returned in queries. Removed the redundant `delete ownerObject.password` lines from the service.

### 2. Weak Secret Detection in `JwtStrategy`

*   **Vulnerability:** The `JwtStrategy` used a hardcoded and incomplete list of weak secrets for validation.
*   **Fix:** Strengthened the secret validation by:
    *   Enforcing a minimum secret length of 64 characters.
    *   Expanding the list of weak secrets.
    *   Improving the error messages to provide better guidance to the user.

    ```typescript
    // src/auth/strategies/jwt.strategy.ts
    
    if (jwtSecret.length < 64) {
      throw new Error(
        `❌ CRITICAL SECURITY ERROR: JWT_SECRET is too short (${jwtSecret.length} characters)!\n` +
        'JWT_SECRET must be at least 64 characters (128 recommended).\n' +
        'Generate a secure secret with: openssl rand -hex 64'
      );
    }

    const weakSecrets = ['secret', 'fallback-secret-key', 'your-secret-key', 'jwt-secret', 'change-me', '123456789', 'password', 'qwerty'];
    if (weakSecrets.includes(jwtSecret.toLowerCase())) {
      throw new Error(
        '❌ CRITICAL SECURITY ERROR: JWT_SECRET is using a default/weak value!\n' +
        'NEVER use default secrets in production.\n' +
        'Generate a secure secret with: openssl rand -hex 64'
      );
    }
    ```

### 3. Improper JWT Validation for Multiple User Types

*   **Vulnerability:** The `JwtStrategy` was incorrectly trying to validate all tokens against the main `users` table, which would cause an error for `BookhireOwner` tokens.
*   **Fix:** Modified the `JwtStrategy` to handle both `User` and `BookhireOwner` tokens by:
    *   Injecting both the `UserRepository` and `BookhireOwnerRepository`.
    *   Checking the `type` claim in the JWT payload.
    *   Using the appropriate repository to validate the token.
    *   Normalizing the returned user object to a consistent shape.

    ```typescript
    // src/auth/strategies/jwt.strategy.ts
    async validate(payload: JwtPayload | EnhancedJwtPayload) {
      // ...
      if (payload.type === 'bookhire-owner') {
        user = await this.bookhireOwnerRepository.findOne({ where: { id: userId } });
        userType = 'bookhire-owner';
      } else {
        user = await this.userRepository.findOne({ 
          where: { id: userId },
          select: ['id', 'email', 'firstName', 'lastName', 'isActive', 'userType', 'imageUrl']
        });
        userType = user?.userType;
      }
      // ...
      const normalizedUser = {
        id: user.id,
        userId: user.id,
        sub: user.id,
        s: user.id,
        email: user.email,
        userType: userType,
        firstName: user.firstName || user.name, // Use name from BookhireOwner
        lastName: user.lastName,
        imageUrl: user.imageUrl || user.profileImage, // Use profileImage from BookhireOwner
        jwtPayload: payload,
        ...payload,
        hasGlobalInstituteAccess: enhancedClaims?.hasGlobalAccess ?? false,
        enhancedInstituteAccess: enhancedClaims?.instituteAccess,
        enhancedChildrenAccess: enhancedClaims?.childrenAccess
      };

      return normalizedUser;
    }
    ```
