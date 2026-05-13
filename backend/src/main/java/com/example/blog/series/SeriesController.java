package com.example.blog.series;

import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/series")
public class SeriesController {

    private final SeriesService seriesService;

    public SeriesController(SeriesService seriesService) {
        this.seriesService = seriesService;
    }

    @GetMapping
    public List<SeriesSummaryResponse> listPublished() {
        return seriesService.listPublished();
    }

    @GetMapping("/{slug}")
    public SeriesDetailResponse getBySlug(@PathVariable String slug) {
        return seriesService.getBySlug(slug);
    }
}
