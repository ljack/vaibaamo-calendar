import './JourneyOverlay.css'; // Reuse existing CSS

const PHOTOS = [
    'https://picsum.photos/seed/finland1/800/600', // Finland landscape
    'https://picsum.photos/seed/reindeer2/800/600', // Reindeer
    'https://picsum.photos/seed/sauna3/800/600', // Sauna
    'https://picsum.photos/seed/coding4/800/600', // Coding
    'https://picsum.photos/seed/car5/800/600', // Car
    'https://picsum.photos/seed/tech6/800/600', // Tech
];

export default function JourneyCollage({ onClose }: { onClose: () => void }) {
    return (
        <div className="victory-modal collage-mode">
            <h1>JOURNEY MEMORIES</h1>
            <div className="collage-grid">
                {PHOTOS.map((url, i) => (
                    <div key={i} className="collage-item">
                        <img src={url + '?auto=format&fit=crop&w=300&q=80'} alt="Trip memory" />
                        <span className="collage-caption">Memory #{i + 1}</span>
                    </div>
                ))}
            </div>
            <div className="collage-footer">
                <p>What a ride! 550km/h through the vibe dimension.</p>
                <button onClick={onClose}>Close & Save Memories</button>
            </div>
        </div>
    );
}
