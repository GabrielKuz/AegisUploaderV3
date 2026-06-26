import { useContext } from 'react';
import { ThemeContext } from '../theme/ThemeContext';

export default function Navbar() {
    const { isDark, setIsDark } = useContext(ThemeContext);

    return (
        <nav className="navbar">
            <h1>My App</h1>
            <button onClick={() => setIsDark(!isDark)}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
            </button>
        </nav>
    );
}