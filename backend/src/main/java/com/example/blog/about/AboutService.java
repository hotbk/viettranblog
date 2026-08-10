package com.example.blog.about;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AboutService {

    private final AboutContentRepository repository;

    public AboutService(AboutContentRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public AboutResponse get() {
        return repository.findById(AboutContent.SINGLETON_ID)
                .map(AboutResponse::from)
                .orElseGet(AboutResponse::empty);
    }

    @Transactional
    public AboutResponse update(AboutRequest request) {
        AboutContent about = repository.findById(AboutContent.SINGLETON_ID).orElseGet(AboutContent::new);
        about.setTitle(request.title() == null ? "" : request.title().trim());
        about.setContent(request.content() == null ? "" : request.content());
        return AboutResponse.from(repository.save(about));
    }
}
