package com.example.blog.post;

import com.example.blog.access.AccessGroupRequest;
import com.example.blog.access.AccessGroupResponse;
import com.example.blog.access.AccessGroupService;
import com.example.blog.common.ContentLanguage;
import com.example.blog.comment.Comment;
import com.example.blog.comment.CommentRepository;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("dev")
public class DataSeeder {

    @Bean
    CommandLineRunner seed(
            PostService postService,
            PostRepository postRepository,
            UserRepository userRepository,
            CommentRepository commentRepository,
            AccessGroupService accessGroupService,
            PasswordEncoder passwordEncoder
    ) {
        return args -> {
            seedUsers(userRepository, passwordEncoder);
            List<Post> posts = seedPosts(postService, postRepository);
            seedComments(commentRepository, userRepository, posts);
            seedPrivatePostDemo(postService, postRepository, userRepository, accessGroupService);
            seedTranslationPairDemo(postService, postRepository);
        };
    }

    private void seedUsers(UserRepository userRepository, PasswordEncoder encoder) {
        if (userRepository.count() > 0) {
            return;
        }

        User admin = new User();
        admin.setUsername("admin");
        admin.setEmail("admin@blog.local");
        admin.setPassword(encoder.encode("Admin@2024!"));
        admin.setRole(UserRole.ADMIN);
        admin.setStatus(UserStatus.ACTIVE);

        User reader1 = new User();
        reader1.setUsername("viet_tran");
        reader1.setEmail("viet.tran@example.com");
        reader1.setPassword(encoder.encode("Reader@2024!"));
        reader1.setRole(UserRole.READER);
        reader1.setStatus(UserStatus.ACTIVE);

        User reader2 = new User();
        reader2.setUsername("minh_nguyen");
        reader2.setEmail("minh.nguyen@example.com");
        reader2.setPassword(encoder.encode("Reader@2024!"));
        reader2.setRole(UserRole.READER);
        reader2.setStatus(UserStatus.ACTIVE);

        // Demo data for the private-post feature: one member still waiting on
        // approval, one already active but not yet in any access group.
        User pendingMember = new User();
        pendingMember.setUsername("pending_member");
        pendingMember.setEmail("pending.member@example.com");
        pendingMember.setPassword(encoder.encode("Member@2024!"));
        pendingMember.setRole(UserRole.MEMBER);
        pendingMember.setStatus(UserStatus.PENDING);

        User activeMember = new User();
        activeMember.setUsername("active_member");
        activeMember.setEmail("active.member@example.com");
        activeMember.setPassword(encoder.encode("Member@2024!"));
        activeMember.setRole(UserRole.MEMBER);
        activeMember.setStatus(UserStatus.ACTIVE);

        userRepository.saveAll(List.of(admin, reader1, reader2, pendingMember, activeMember));
    }

    private List<Post> seedPosts(PostService postService, PostRepository postRepository) {
        if (postRepository.count() > 0) {
            return postRepository.findAll();
        }

        postService.create(new PostRequest(
                "Building a Personal Blog with React and Spring Boot",
                "building-personal-blog-react-spring-boot",
                "A practical note on building a clean full-stack blog MVP.",
                "This article explains the first version of a personal blog built with React for the frontend and Spring Boot for the backend. The goal is not to over-engineer, but to create a maintainable foundation.",
                "Technology",
                List.of("react", "spring-boot", "fullstack"),
                PostStatus.PUBLISHED,
                PostVisibility.PUBLIC,
                PostMetadataVisibility.PUBLIC_METADATA
        , ContentLanguage.VI, null), null);

        postService.create(new PostRequest(
                "Why AI Agents Need Clear Boundaries",
                "why-ai-agents-need-clear-boundaries",
                "A short management note about using AI agents without creating chaos.",
                "AI agents are useful only when their responsibilities are explicit. A frontend agent should not rewrite database logic. A review agent should not silently patch code. Boundaries create quality.",
                "AI Workflow",
                List.of("claude-code", "agents", "workflow"),
                PostStatus.PUBLISHED,
                PostVisibility.PUBLIC,
                PostMetadataVisibility.PUBLIC_METADATA
        , ContentLanguage.VI, null), null);

        postService.create(new PostRequest(
                "Getting Started with PostgreSQL and Spring Data JPA",
                "getting-started-postgresql-spring-data-jpa",
                "A beginner-friendly guide to connecting Spring Boot with PostgreSQL using JPA.",
                "This guide walks through setting up a PostgreSQL database, configuring Spring Data JPA, and writing your first repository. We cover datasource properties, entity mapping, and common pitfalls.",
                "Technology",
                List.of("postgresql", "spring-boot", "jpa"),
                PostStatus.PUBLISHED,
                PostVisibility.PUBLIC,
                PostMetadataVisibility.PUBLIC_METADATA
        , ContentLanguage.VI, null), null);

        postService.create(new PostRequest(
                "Ghi chú về quản lý dự án cá nhân",
                "ghi-chu-quan-ly-du-an-ca-nhan",
                "Những bài học rút ra sau nhiều lần thất bại khi quản lý side project.",
                "Quản lý một dự án cá nhân khác hoàn toàn so với làm việc trong team. Bạn không có deadline cứng, không có ai review code, và rất dễ bỏ cuộc. Bài viết này chia sẻ những nguyên tắc giúp tôi duy trì được tiến độ.",
                "Personal",
                List.of("productivity", "side-project", "management"),
                PostStatus.DRAFT,
                PostVisibility.PUBLIC,
                PostMetadataVisibility.PUBLIC_METADATA
        , ContentLanguage.VI, null), null);

        return postRepository.findAll();
    }

    /**
     * One private post + one access group + one member already in it, so the
     * private-post feature has something to click through in local dev
     * without configuring anything by hand first. `active_member` can read
     * it; `pending_member` (still PENDING) and `viet_tran`/`minh_nguyen`
     * (ACTIVE but not in the group) cannot.
     */
    private void seedPrivatePostDemo(PostService postService, PostRepository postRepository,
                                      UserRepository userRepository, AccessGroupService accessGroupService) {
        if (postRepository.existsBySlug("internal-kubernetes-notes")) {
            return;
        }

        postService.create(new PostRequest(
                "Internal Kubernetes Notes",
                "internal-kubernetes-notes",
                "Ghi chú vận hành Kubernetes nội bộ — chỉ dành cho thành viên được cấp quyền.",
                "Đây là nội dung private demo cho tính năng Private Post: cấu hình cluster, runbook xử lý sự cố, và các lưu ý vận hành chỉ chia sẻ nội bộ.",
                "DevOps",
                List.of("kubernetes", "internal", "devops"),
                PostStatus.PUBLISHED,
                PostVisibility.PRIVATE,
                PostMetadataVisibility.PUBLIC_METADATA
        , ContentLanguage.VI, null), null);

        AccessGroupResponse group = accessGroupService.create(
                new AccessGroupRequest("DevOps Internal", "devops-internal",
                        "Ghi chú vận hành nội bộ dành cho đội DevOps.", true));

        Post privatePost = postRepository.findBySlug("internal-kubernetes-notes").orElseThrow();
        accessGroupService.setPostAccessGroups(privatePost.getId(), List.of(group.id()));

        userRepository.findByUsername("active_member")
                .ifPresent(u -> accessGroupService.addUserToGroup(group.id(), u.getId(), null));
    }

    /**
     * One real VI/EN translation pair, so the switcher, hreflang, and the
     * language filter all have something to exercise locally (docs/10-multilingual-content.md
     * §7.9) — without it, this whole feature would ship untested against the
     * only thing it does. Links the English post into the same translation
     * group as the existing "Building a Personal Blog" post via
     * `translationOfPostId`, which also copies its access config (both PUBLIC
     * here, so nothing visibly changes).
     */
    private void seedTranslationPairDemo(PostService postService, PostRepository postRepository) {
        if (postRepository.existsBySlug("building-a-personal-blog-with-react-and-spring-boot-en")) {
            return;
        }
        Post source = postRepository.findBySlug("building-personal-blog-react-spring-boot").orElse(null);
        if (source == null) {
            return;
        }
        postService.create(new PostRequest(
                "Building a Personal Blog with React and Spring Boot",
                "building-a-personal-blog-with-react-and-spring-boot-en",
                "A practical note on building a clean full-stack blog MVP.",
                "This article explains the first version of a personal blog built with React for the frontend "
                        + "and Spring Boot for the backend. The goal is not to over-engineer, but to create a "
                        + "maintainable foundation.",
                "Technology",
                List.of("react", "spring-boot", "fullstack"),
                PostStatus.PUBLISHED,
                PostVisibility.PUBLIC,
                PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN,
                source.getId()
        ), null);
    }

    private void seedComments(
            CommentRepository commentRepository,
            UserRepository userRepository,
            List<Post> posts
    ) {
        if (commentRepository.count() > 0 || posts.isEmpty()) {
            return;
        }

        User reader1 = userRepository.findByUsername("viet_tran").orElse(null);
        User reader2 = userRepository.findByUsername("minh_nguyen").orElse(null);

        Post firstPost = posts.stream()
                .filter(p -> p.getSlug().equals("building-personal-blog-react-spring-boot"))
                .findFirst()
                .orElse(posts.get(0));

        Post secondPost = posts.stream()
                .filter(p -> p.getSlug().equals("why-ai-agents-need-clear-boundaries"))
                .findFirst()
                .orElse(posts.size() > 1 ? posts.get(1) : posts.get(0));

        // Comments on first post
        Comment c1 = new Comment();
        c1.setPost(firstPost);
        c1.setUser(reader1);
        c1.setAuthorName(reader1 != null ? reader1.getUsername() : "viet_tran");
        c1.setAuthorEmail(reader1 != null ? reader1.getEmail() : "viet.tran@example.com");
        c1.setContent("Bài viết rất hay! Mình đang dùng Spring Boot và React cho dự án của mình, sẽ áp dụng ngay cách tiếp cận này.");

        Comment c2 = new Comment();
        c2.setPost(firstPost);
        c2.setUser(reader2);
        c2.setAuthorName(reader2 != null ? reader2.getUsername() : "minh_nguyen");
        c2.setAuthorEmail(reader2 != null ? reader2.getEmail() : "minh.nguyen@example.com");
        c2.setContent("Mình tò mò về phần authentication, bạn có thể viết thêm về JWT không?");

        // Anonymous comment
        Comment c3 = new Comment();
        c3.setPost(firstPost);
        c3.setUser(null);
        c3.setAuthorName("Khách vãng lai");
        c3.setAuthorEmail(null);
        c3.setContent("Cảm ơn bài viết, rất hữu ích cho người mới bắt đầu như mình.");

        // Comments on second post
        Comment c4 = new Comment();
        c4.setPost(secondPost);
        c4.setUser(reader1);
        c4.setAuthorName(reader1 != null ? reader1.getUsername() : "viet_tran");
        c4.setAuthorEmail(reader1 != null ? reader1.getEmail() : "viet.tran@example.com");
        c4.setContent("Hoàn toàn đồng ý. Mình đã từng để AI agent làm mọi thứ và kết quả rất khó kiểm soát.");

        Comment c5 = new Comment();
        c5.setPost(secondPost);
        c5.setUser(null);
        c5.setAuthorName("An Reader");
        c5.setAuthorEmail("an@example.com");
        c5.setContent("Bài viết ngắn gọn nhưng đúng trọng tâm. Cần đọc trước khi dùng Claude Code!");

        commentRepository.saveAll(List.of(c1, c2, c3, c4, c5));
    }
}
