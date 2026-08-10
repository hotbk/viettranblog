package com.example.blog.access;

import com.example.blog.user.UserService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Admin-only (guarded by SecurityConfig's `/api/admin/**` -> hasRole("ADMIN") matcher). */
@RestController
@RequestMapping("/api/admin/access-groups")
public class AdminAccessGroupController {

    private final AccessGroupService accessGroupService;
    private final UserService userService;

    public AdminAccessGroupController(AccessGroupService accessGroupService, UserService userService) {
        this.accessGroupService = accessGroupService;
        this.userService = userService;
    }

    @GetMapping
    public List<AccessGroupResponse> listAll() {
        return accessGroupService.listAll();
    }

    @GetMapping("/{id}")
    public AccessGroupResponse getById(@PathVariable Long id) {
        return accessGroupService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccessGroupResponse create(@Valid @RequestBody AccessGroupRequest request) {
        return accessGroupService.create(request);
    }

    @PutMapping("/{id}")
    public AccessGroupResponse update(@PathVariable Long id, @Valid @RequestBody AccessGroupRequest request) {
        return accessGroupService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        accessGroupService.delete(id);
    }

    @GetMapping("/{id}/users")
    public List<UserBrief> listUsers(@PathVariable Long id) {
        return accessGroupService.getGroupUsers(id);
    }

    @PostMapping("/{id}/users/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addUser(@PathVariable Long id, @PathVariable Long userId) {
        accessGroupService.addUserToGroup(id, userId, userService.currentUserIdOrNull());
    }

    @DeleteMapping("/{id}/users/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeUser(@PathVariable Long id, @PathVariable Long userId) {
        accessGroupService.removeUserFromGroup(id, userId, userService.currentUserIdOrNull());
    }
}
