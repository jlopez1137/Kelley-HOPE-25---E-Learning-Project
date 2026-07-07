import { COURSE, SECTIONS } from '../course';

export default function CourseNav({ course, onSelect }) {
  const { currentIndex, completed, openModules, progress, hasPrev, hasNext } = course;

  const goPrev = () => hasPrev && onSelect(course.currentIndex - 1);
  const goNext = () =>
    hasNext && onSelect(currentIndex === null ? 0 : currentIndex + 1);

  return (
    <nav className="course-nav">
      <div className="course-nav__modules">
        {COURSE.map((module, moduleIndex) => {
          const isOpen = openModules.has(moduleIndex);
          return (
            <div className="module" key={module.title}>
              <button
                className="module__header"
                onClick={() => course.toggleModule(moduleIndex)}
                aria-expanded={isOpen}
              >
                <span className={`module__chevron ${isOpen ? 'module__chevron--open' : ''}`}>
                  ▸
                </span>
                {module.title}
              </button>
              {isOpen && (
                <ul className="module__sections">
                  {module.sections.map((section, sectionIndex) => {
                    const flatIndex = SECTIONS.findIndex(
                      (s) => s.moduleIndex === moduleIndex && s.section === section
                    );
                    const { key } = SECTIONS[flatIndex];
                    const isActive = flatIndex === currentIndex;
                    const isDone = completed.has(key);
                    return (
                      <li key={key}>
                        <button
                          className={`section ${isActive ? 'section--active' : ''}`}
                          onClick={() => onSelect(flatIndex)}
                        >
                          <span className="section__title">{section}</span>
                          {isDone && <span className="section__check">✓</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="course-nav__footer">
        <div className="progress">
          <div className="progress__track">
            <div className="progress__fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress__label">{progress}% complete</span>
        </div>
        <div className="course-nav__buttons">
          <button className="nav-btn" onClick={goPrev} disabled={!hasPrev}>
            ← Previous
          </button>
          <button className="nav-btn" onClick={goNext} disabled={!hasNext}>
            Next →
          </button>
        </div>
      </div>
    </nav>
  );
}
