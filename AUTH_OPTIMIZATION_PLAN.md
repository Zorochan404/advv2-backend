 # Authentication System Optimization Plan

## 🎯 **Proposed New Structure**

### **Clean, Professional API Design:**

```
POST /api/v1/auth/login                    # Unified login endpoint
POST /api/v1/auth/register                 # User registration
POST /api/v1/auth/staff/register           # Staff registration (admin only)
POST /api/v1/auth/refresh                  # Token refresh
POST /api/v1/auth/logout                   # Logout
POST /api/v1/auth/forgot-password          # Password reset
POST /api/v1/auth/reset-password           # Password reset confirmation
```

### **Request/Response Standardization:**

#### **Unified Login Request:**
```json
{
  "identifier": "7002803551",           // Phone number or email
  "password": "password123",            // For staff users
  "otp": "123456",                      // For user OTP login
  "authMethod": "password|otp"          // Explicit auth method
}
```

#### **Unified Login Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 16,
      "name": "John Doe",
      "email": "john@example.com",
      "number": "7002803551",
      "role": "user",
      "isVerified": true,
      "createdAt": "2025-01-08T14:09:23.278Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": "1d"
    },
    "isNewUser": false
  }
}
```

## 🔧 **Key Improvements**

### **1. Unified Login Endpoint:**
- **Single `/login`** endpoint for all user types
- **Explicit authentication method** selection
- **Role-based logic** handled internally
- **Consistent request/response format**

### **2. Clear Separation:**
- **User registration** - Public endpoint for customers
- **Staff registration** - Admin-only endpoint for employees
- **Different validation** rules for each type

### **3. Enhanced Security:**
- **JWT + Refresh Token** system
- **Rate limiting** on authentication attempts
- **Proper password hashing** for all users
- **OTP expiration** and validation
- **Account lockout** after failed attempts

### **4. Backward Compatibility:**
- **Legacy endpoints** maintained with deprecation warnings
- **Gradual migration** path for existing clients
- **Version-based routing** support

## 📋 **Implementation Strategy**

### **Phase 1: New Unified System**
1. Create new unified authentication endpoints
2. Implement proper token management
3. Add enhanced security features

### **Phase 2: Backward Compatibility**
1. Maintain existing endpoints with deprecation warnings
2. Add migration documentation
3. Provide client SDK updates

### **Phase 3: Legacy Cleanup**
1. Remove deprecated endpoints after migration period
2. Clean up old authentication logic
3. Update documentation

## 🛡️ **Security Enhancements**

### **Authentication Methods:**
- **Password-based** - For staff (admin, PIC, vendor)
- **OTP-based** - For customers (users)
- **Multi-factor** - Optional for admin accounts

### **Token Management:**
- **Access tokens** - Short-lived (1 hour)
- **Refresh tokens** - Long-lived (30 days)
- **Token rotation** - Automatic refresh
- **Blacklist support** - For logout/security

### **Rate Limiting:**
- **Login attempts** - 5 per minute per IP
- **OTP requests** - 3 per minute per number
- **Password reset** - 3 per hour per email

## 🎨 **API Examples**

### **User OTP Login:**
```bash
POST /api/v1/auth/login
{
  "identifier": "7002803551",
  "otp": "123456",
  "authMethod": "otp"
}
```

### **Staff Password Login:**
```bash
POST /api/v1/auth/login
{
  "identifier": "9999999999",
  "password": "admin123",
  "authMethod": "password"
}
```

### **User Registration:**
```bash
POST /api/v1/auth/register
{
  "number": "7002803551",
  "name": "John Doe",
  "email": "john@example.com"
}
```

### **Staff Registration (Admin Only):**
```bash
POST /api/v1/auth/staff/register
{
  "number": "9999999999",
  "password": "admin123",
  "role": "admin",
  "name": "Admin User",
  "email": "admin@example.com"
}
```

## 📊 **Migration Benefits**

### **For Developers:**
- **Cleaner API** - Single login endpoint
- **Better documentation** - Clear authentication flow
- **Easier testing** - Consistent request/response format
- **Better error handling** - Standardized error responses

### **For Security:**
- **Enhanced protection** - Rate limiting, token rotation
- **Better audit trail** - Comprehensive logging
- **Reduced attack surface** - Unified authentication logic
- **Compliance ready** - Industry standard practices

### **For Users:**
- **Better UX** - Clear authentication methods
- **Faster login** - Optimized token management
- **More secure** - Enhanced security features
- **Future-proof** - Scalable architecture





