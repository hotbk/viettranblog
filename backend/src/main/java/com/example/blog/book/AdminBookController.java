package com.example.blog.book;

import com.example.blog.access.AccessGroupBrief;
import com.example.blog.access.AccessGroupService;
import com.example.blog.access.UserBrief;
import com.example.blog.user.UserService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/books")
public class AdminBookController {

    private final BookService bookService;
    private final AccessGroupService accessGroupService;
    private final UserService userService;

    public AdminBookController(BookService bookService, AccessGroupService accessGroupService,
                                UserService userService) {
        this.bookService = bookService;
        this.accessGroupService = accessGroupService;
        this.userService = userService;
    }

    @GetMapping
    public List<BookResponse> listAll() {
        return bookService.search(null, null, null, true);
    }

    @GetMapping("/{id}")
    public BookResponse getById(@PathVariable Long id) {
        return bookService.getAdminDetail(id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public BookResponse create(
            @RequestParam String title,
            @RequestParam String slug,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String category,
            @RequestParam BookStatus status,
            @RequestParam(defaultValue = "PUBLIC") BookVisibility visibility,
            @RequestParam(required = false) BookMetadataVisibility metadataVisibility,
            @RequestParam(defaultValue = "true") boolean downloadable,
            @RequestPart MultipartFile file,
            @RequestPart(required = false) MultipartFile coverImage) {

        BookRequest request = new BookRequest(title, slug, author, description, category, status,
                visibility, metadataVisibility, downloadable);
        return bookService.create(request, file, coverImage);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BookResponse update(
            @PathVariable Long id,
            @RequestParam String title,
            @RequestParam String slug,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String description,
            @RequestParam(required = false) String category,
            @RequestParam BookStatus status,
            @RequestParam(defaultValue = "PUBLIC") BookVisibility visibility,
            @RequestParam(required = false) BookMetadataVisibility metadataVisibility,
            @RequestParam(defaultValue = "true") boolean downloadable,
            @RequestPart(required = false) MultipartFile file,
            @RequestPart(required = false) MultipartFile coverImage,
            @RequestParam(required = false, defaultValue = "false") boolean removeCoverImage) {

        BookRequest request = new BookRequest(title, slug, author, description, category, status,
                visibility, metadataVisibility, downloadable);
        return bookService.update(id, request, file, coverImage, removeCoverImage);
    }

    @PutMapping("/{id}/status")
    public BookResponse updateStatus(@PathVariable Long id, @RequestParam BookStatus status) {
        return bookService.updateStatus(id, status);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        bookService.delete(id);
    }

    // --- private-book access management, mirrors /api/admin/posts/{id}/access-groups ---

    @GetMapping("/{id}/access-groups")
    public List<AccessGroupBrief> getAccessGroups(@PathVariable Long id) {
        return accessGroupService.getBookAccessGroups(id);
    }

    @PutMapping("/{id}/access-groups")
    public List<AccessGroupBrief> setAccessGroups(@PathVariable Long id, @RequestBody List<Long> groupIds) {
        accessGroupService.setBookAccessGroups(id, groupIds);
        return accessGroupService.getBookAccessGroups(id);
    }

    @GetMapping("/{id}/access-users")
    public List<UserBrief> getAccessUsers(@PathVariable Long id) {
        return accessGroupService.getBookDirectUsers(id);
    }

    @PutMapping("/{id}/access-users")
    public List<UserBrief> setAccessUsers(@PathVariable Long id, @RequestBody List<Long> userIds) {
        accessGroupService.setBookDirectUsers(id, userIds, userService.currentUserIdOrNull());
        return accessGroupService.getBookDirectUsers(id);
    }
}
