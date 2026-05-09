package com.example.blog.auth;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final String adminUsername;
    private final String adminPasswordHash;

    public AuthController(
            JwtService jwtService,
            PasswordEncoder passwordEncoder,
            @Value("${blog.admin.username}") String adminUsername,
            @Value("${blog.admin.password}") String adminPassword) {
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.adminUsername = adminUsername;
        // Hash the configured password at startup
        this.adminPasswordHash = passwordEncoder.encode(adminPassword);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        boolean usernameMatch = adminUsername.equals(request.username());
        boolean passwordMatch = usernameMatch && passwordEncoder.matches(request.password(), adminPasswordHash);

        // Always run passwordEncoder.matches to prevent timing attacks
        if (!usernameMatch) {
            // Still call matches to consume similar time
            passwordEncoder.matches(request.password(), adminPasswordHash);
        }

        if (!usernameMatch || !passwordMatch) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        String token = jwtService.generateToken(adminUsername);
        return new LoginResponse(token, adminUsername, "ADMIN");
    }
}
