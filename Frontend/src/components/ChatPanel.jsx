import AvatarBanner from './AvatarBanner';
import MessageList from './MessageList';
import InputBar from './InputBar';

export default function ChatPanel({ messages, isLoading, onSend }) {
  return (
    <section className="chat-panel">
      <AvatarBanner />
      <MessageList messages={messages} isLoading={isLoading} />
      <InputBar onSend={onSend} isLoading={isLoading} />
    </section>
  );
}
