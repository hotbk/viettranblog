package com.example.blog.series;

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

@RestController
@RequestMapping("/api/admin/series")
public class AdminSeriesController {

    private final SeriesService seriesService;

    public AdminSeriesController(SeriesService seriesService) {
        this.seriesService = seriesService;
    }

    @GetMapping
    public List<SeriesSummaryResponse> listAll() {
        return seriesService.listAll();
    }

    @GetMapping("/{id}")
    public SeriesDetailResponse getById(@PathVariable Long id) {
        return seriesService.getById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SeriesDetailResponse create(@Valid @RequestBody SeriesRequest req) {
        return seriesService.create(req);
    }

    @PutMapping("/{id}")
    public SeriesDetailResponse update(@PathVariable Long id, @Valid @RequestBody SeriesRequest req) {
        return seriesService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        seriesService.delete(id);
    }

    @PutMapping("/{id}/posts")
    public SeriesDetailResponse setPosts(@PathVariable Long id, @RequestBody SeriesPostsRequest req) {
        return seriesService.setPostOrder(id, req);
    }
}
