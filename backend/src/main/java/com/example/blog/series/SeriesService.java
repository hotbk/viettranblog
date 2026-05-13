package com.example.blog.series;

import com.example.blog.common.NotFoundException;
import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SeriesService {

    private final SeriesRepository seriesRepository;
    private final SeriesPostRepository seriesPostRepository;
    private final PostRepository postRepository;

    public SeriesService(SeriesRepository seriesRepository,
                         SeriesPostRepository seriesPostRepository,
                         PostRepository postRepository) {
        this.seriesRepository = seriesRepository;
        this.seriesPostRepository = seriesPostRepository;
        this.postRepository = postRepository;
    }

    @Transactional(readOnly = true)
    public List<SeriesSummaryResponse> listPublished() {
        return seriesRepository.findByStatus(PostStatus.PUBLISHED).stream()
                .map(s -> toSummary(s, seriesPostRepository.findBySeriesIdOrderByPositionAsc(s.getId()).size()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SeriesSummaryResponse> listAll() {
        return seriesRepository.findAll().stream()
                .map(s -> toSummary(s, seriesPostRepository.findBySeriesIdOrderByPositionAsc(s.getId()).size()))
                .toList();
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getBySlug(String slug) {
        Series series = seriesRepository.findBySlug(slug)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));
        return toDetail(series);
    }

    @Transactional(readOnly = true)
    public SeriesDetailResponse getById(Long id) {
        Series series = seriesRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));
        return toDetail(series);
    }

    @Transactional
    public SeriesDetailResponse create(SeriesRequest req) {
        if (seriesRepository.existsBySlug(req.slug().trim())) {
            throw new IllegalArgumentException("Slug already exists");
        }
        Series series = new Series();
        apply(series, req);
        return toDetail(seriesRepository.save(series));
    }

    @Transactional
    public SeriesDetailResponse update(Long id, SeriesRequest req) {
        Series series = seriesRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));
        String newSlug = req.slug().trim();
        if (!series.getSlug().equals(newSlug) && seriesRepository.existsBySlugAndIdNot(newSlug, id)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        apply(series, req);
        return toDetail(seriesRepository.save(series));
    }

    @Transactional
    public void delete(Long id) {
        if (!seriesRepository.existsById(id)) {
            throw new NotFoundException("SERIES_NOT_FOUND", "Series not found");
        }
        seriesPostRepository.deleteBySeriesId(id);
        seriesRepository.deleteById(id);
    }

    @Transactional
    public SeriesDetailResponse setPostOrder(Long id, SeriesPostsRequest req) {
        Series series = seriesRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("SERIES_NOT_FOUND", "Series not found"));

        List<Long> postIds = req.postIds() == null ? List.of() : req.postIds();
        for (Long postId : postIds) {
            if (!postRepository.existsById(postId)) {
                throw new IllegalArgumentException("Post not found: " + postId);
            }
        }

        seriesPostRepository.deleteBySeriesId(id);
        seriesPostRepository.flush();

        int position = 1;
        for (Long postId : postIds) {
            Post post = postRepository.getReferenceById(postId);
            SeriesPost sp = new SeriesPost();
            sp.setSeries(series);
            sp.setPost(post);
            sp.setPosition(position++);
            seriesPostRepository.save(sp);
        }

        return toDetail(series);
    }

    // --- helpers ---

    private static void apply(Series series, SeriesRequest req) {
        series.setTitle(req.title().trim());
        series.setSlug(req.slug().trim());
        series.setDescription(req.description());
        if (req.status() != null) {
            series.setStatus(req.status());
        }
    }

    private SeriesSummaryResponse toSummary(Series s, int postCount) {
        return new SeriesSummaryResponse(
                s.getId(), s.getTitle(), s.getSlug(), s.getDescription(),
                s.getStatus(), postCount, s.getCreatedAt(), s.getUpdatedAt());
    }

    SeriesDetailResponse toDetail(Series series) {
        List<SeriesPost> seriesPosts = seriesPostRepository.findBySeriesIdOrderByPositionAsc(series.getId());
        List<SeriesPostItem> items = seriesPosts.stream()
                .map(sp -> new SeriesPostItem(
                        sp.getPosition(),
                        sp.getPost().getId(),
                        sp.getPost().getTitle(),
                        sp.getPost().getSlug(),
                        sp.getPost().getExcerpt(),
                        sp.getPost().getStatus(),
                        sp.getPost().getPublishedAt()))
                .toList();
        return new SeriesDetailResponse(
                series.getId(), series.getTitle(), series.getSlug(), series.getDescription(),
                series.getStatus(), items.size(), series.getCreatedAt(), series.getUpdatedAt(), items);
    }
}
