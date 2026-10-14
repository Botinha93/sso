export class AppError extends Error {
    statusCode;
    constructor(message, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}
export class AuthenticationError extends AppError {
    constructor(message = "Authentication failed") {
        super(message, 401);
        this.name = "AuthenticationError";
    }
}
export class AuthorizationError extends AppError {
    constructor(message = "Not authorized") {
        super(message, 403);
        this.name = "AuthorizationError";
    }
}
export class ValidationError extends AppError {
    constructor(message = "Invalid request") {
        super(message, 422);
        this.name = "ValidationError";
    }
}
