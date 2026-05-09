package com.example.blog.post;

import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSeeder {
    @Bean
    CommandLineRunner seedPosts(PostService postService, PostRepository postRepository) {
        return args -> {
            if (postRepository.count() > 0) {
                return;
            }

            postService.create(new PostRequest(
                    "Building a Personal Blog with React and Spring Boot",
                    "building-personal-blog-react-spring-boot",
                    "A practical note on building a clean full-stack blog MVP.",
                    "This article explains the first version of a personal blog built with React for the frontend and Spring Boot for the backend. The goal is not to over-engineer, but to create a maintainable foundation.",
                    "Technology",
                    List.of("react", "spring-boot", "fullstack"),
                    PostStatus.PUBLISHED
            ));

            postService.create(new PostRequest(
                    "Why AI Agents Need Clear Boundaries",
                    "why-ai-agents-need-clear-boundaries",
                    "A short management note about using AI agents without creating chaos.",
                    "AI agents are useful only when their responsibilities are explicit. A frontend agent should not rewrite database logic. A review agent should not silently patch code. Boundaries create quality.",
                    "AI Workflow",
                    List.of("claude-code", "agents", "workflow"),
                    PostStatus.PUBLISHED
            ));
        };
    }
}
