type FloatingAIButtonProps = {
  isActive?: boolean;
  onOpen: () => void;
};

function FloatingAIButton({ isActive = false, onOpen }: FloatingAIButtonProps) {
  return (
    <button
      aria-label="Buka halaman AI UniLibra"
      aria-pressed={isActive}
      className={`floating-ai-button ${isActive ? "is-active" : ""}`.trim()}
      onClick={onOpen}
      type="button"
    >
      <img alt="" src="/robot-assistant.png" />
    </button>
  );
}

export default FloatingAIButton;
