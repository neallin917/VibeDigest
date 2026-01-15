## ADDED Requirements

### Requirement: Agentic Task Initiation
The system SHALL allow users to start a video processing task by providing a URL in the chat interface.

#### Scenario: User provides a link
- **WHEN** the user pastes a YouTube URL into the chat
- **THEN** the system identifies it as a video source
- **AND** displays a summary/preview of the video (Video Card)
- **AND** presents a plan to process it (e.g., "I will download, transcribe, and summarize this.")

### Requirement: Generative Progress Visualization
The system SHALL display the layout and progress of the background processing task as a rich UI element within the chat stream, rather than plain text updates.

#### Scenario: Visualizing Progress
- **WHEN** the processing task initiates
- **THEN** a "Progress Card" appears in the chat matching the "Comprehensive Plan" style
- **AND** it displays a progress bar (e.g. "X of Y steps")
- **AND** it lists individual steps (Download, Transcribe, etc.) with their real-time status icons
- **AND** textual clutter is minimized.

### Requirement: Seamless Q&A Transition
The system SHALL automatically transition the chat context to "Q&A mode" upon task completion.

#### Scenario: Task completes
- **WHEN** the "Progress Card" reaches 100% / Completed
- **THEN** the agent invites the user to ask questions
- **AND** subsequent user queries are answered using the video's transcript/summary as context.
