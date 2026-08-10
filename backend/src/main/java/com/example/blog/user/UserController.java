package com.example.blog.user;

import com.example.blog.access.AccessGroupService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/users")
public class UserController {

    private final UserService userService;
    private final AccessGroupService accessGroupService;

    public UserController(UserService userService, AccessGroupService accessGroupService) {
        this.userService = userService;
        this.accessGroupService = accessGroupService;
    }

    @GetMapping
    public List<UserResponse> getAll(@RequestParam(required = false) UserStatus status) {
        return status != null ? userService.getByStatus(status) : userService.getAll();
    }

    @GetMapping("/{id}")
    public UserDetailResponse getById(@PathVariable Long id) {
        UserResponse base = userService.getById(id);
        return UserDetailResponse.from(base,
                accessGroupService.getUserAccessGroups(id),
                accessGroupService.getUserDirectPostAccess(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse create(@RequestBody UserRequest request) {
        return userService.create(request);
    }

    @PutMapping("/{id}/role")
    public UserResponse updateRole(@PathVariable Long id, @RequestParam UserRole role) {
        return userService.updateRole(id, role);
    }

    @PutMapping("/{id}/status")
    public UserResponse updateStatus(@PathVariable Long id, @RequestParam UserStatus status) {
        return userService.updateStatus(id, status, userService.currentUserIdOrNull());
    }

    @PutMapping("/{id}/access-groups")
    public UserDetailResponse updateAccessGroups(@PathVariable Long id, @RequestBody List<Long> groupIds) {
        accessGroupService.setUserAccessGroups(id, groupIds, userService.currentUserIdOrNull());
        UserResponse base = userService.getById(id);
        return UserDetailResponse.from(base,
                accessGroupService.getUserAccessGroups(id),
                accessGroupService.getUserDirectPostAccess(id));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        userService.delete(id);
    }
}
