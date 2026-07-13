import Header from './components/Header';
import CourseNav from './components/CourseNav';
import ChatPanel from './components/ChatPanel';
import { useChat } from './hooks/useChat';
import { useCourse } from './hooks/useCourse';
import { SECTIONS } from './course';
import './app.css';

export default function App() {
  const { messages, isLoading, send, sendIntro } = useChat();
  const course = useCourse();

  const handleSelectSection = (index) => {
    if (index === course.currentIndex) return;
    course.select(index);
    const { moduleTitle, section } = SECTIONS[index];
    sendIntro(moduleTitle, section);
  };

  const handleSend = (text) => {
    const enriched = course.current
      ? `The student is currently studying ${course.current.moduleTitle} - ${course.current.section}. Answer the following question as an encouraging teacher would to a student learning this for the first time: ${text}`
      : text;
    send(text, enriched);
  };

  return (
    <div className="app">
      <Header />
      <div className="app__body">
        <CourseNav course={course} onSelect={handleSelectSection} />
        <ChatPanel messages={messages} isLoading={isLoading} onSend={handleSend} />
      </div>
    </div>
  );
}
