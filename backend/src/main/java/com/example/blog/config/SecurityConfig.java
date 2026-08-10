package com.example.blog.config;

import com.example.blog.auth.JwtAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/sitemap.xml").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/about").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/*/cover-image").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/*/comments").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/posts/*/view").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/posts/*/comments").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/posts/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/series", "/api/series/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/exams").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/images/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/videos/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/books").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/books/*/cover-image").permitAll()
                        // Progress/me-reading matchers MUST come before the GET /api/books/** wildcard below —
                        // first-match-wins ordering means placing the wildcard first would silently make
                        // progress endpoints anonymous (see R4, docs/08-book-library-module.md §5.3).
                        .requestMatchers(HttpMethod.GET, "/api/books/*/progress").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/books/*/progress").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/me/reading").authenticated()
                        // Same ordering requirement for highlights — a reader's private
                        // notes, so GET must sit above the wildcard too (R4 again, see
                        // docs/09-book-highlights-phase2.md §5.4). POST/PUT/DELETE are
                        // already covered by .anyRequest().authenticated() below, listed
                        // anyway so this reads as one unit.
                        .requestMatchers(HttpMethod.GET, "/api/books/*/highlights").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/books/*/highlights").authenticated()
                        .requestMatchers(HttpMethod.PUT, "/api/books/*/highlights/*").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/books/*/highlights/*").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/me/highlights").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/books/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/posts").hasAnyRole("ADMIN", "EDITOR")
                        .requestMatchers(HttpMethod.PUT, "/api/posts/**").hasAnyRole("ADMIN", "EDITOR")
                        .requestMatchers(HttpMethod.DELETE, "/api/posts/**").hasAnyRole("ADMIN", "EDITOR")
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/member/**").hasRole("MEMBER")
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setContentType("application/json");
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.getWriter().write(
                                    "{\"code\":\"UNAUTHORIZED\",\"message\":\"Authentication required\"}");
                        })
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of(
                "https://*:5173", "https://*:5174", "http://localhost:*",
                "https://tech2blogs.com", "https://www.tech2blogs.com",
                "https://blog.datxesocson.vn", "https://www.blog.datxesocson.vn"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
