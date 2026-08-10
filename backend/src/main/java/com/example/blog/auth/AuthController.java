package com.example.blog.auth;

import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final UserService userService;

    public AuthController(JwtService jwtService, PasswordEncoder passwordEncoder,
                          UserRepository userRepository, UserService userService) {
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.userService = userService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        User user = userRepository.findByUsername(request.username())
                .orElse(null);

        boolean credentialsValid = user != null
                && passwordEncoder.matches(request.password(), user.getPassword());

        if (!credentialsValid) {
            // Always encode to prevent timing attacks
            passwordEncoder.matches(request.password(),
                    "$2a$10$dummyhashtopreventtimingattacksxx");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        if (user.getRole() == UserRole.READER) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Access denied: admin or editor role required");
        }

        // Deliberately NOT blocked here for PENDING/REJECTED/SUSPENDED: authentication
        // ("who are you") and approval ("are you allowed in the members area") are
        // separate layers. A pending/suspended member can still log in and see their
        // own status (see /me and PostDetail's reason-coded denial states); every
        // private-post read is gated at authorization time instead.
        String token = jwtService.generateToken(user.getUsername(), user.getRole().name());
        return new LoginResponse(token, user.getUsername(), user.getRole().name());
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public MeResponse register(@Valid @RequestBody RegisterRequest request) {
        var created = userService.registerSelf(request.username().trim(), request.email().trim(), request.password());
        return new MeResponse(created.username(), created.role(), created.status());
    }

    @GetMapping("/me")
    public MeResponse me() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        User user = userRepository.findByUsername(auth.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated"));
        return new MeResponse(user.getUsername(), user.getRole(), user.getStatus());
    }
}
