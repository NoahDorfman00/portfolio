// Initialize AOS (Animate On Scroll)
AOS.init({
    duration: 800,
    once: true
});

// Initialize Particles.js
particlesJS('particles-js', {
    particles: {
        number: {
            value: 80,
            density: {
                enable: true,
                value_area: 800
            }
        },
        color: {
            value: '#ffffff'
        },
        shape: {
            type: 'circle'
        },
        opacity: {
            value: 0.5,
            random: false
        },
        size: {
            value: 3,
            random: true
        },
        line_linked: {
            enable: true,
            distance: 150,
            color: '#ffffff',
            opacity: 0.4,
            width: 1
        },
        move: {
            enable: true,
            speed: 2,
            direction: 'none',
            random: false,
            straight: false,
            out_mode: 'out',
            bounce: false
        }
    },
    interactivity: {
        detect_on: 'canvas',
        events: {
            onhover: {
                enable: true,
                mode: 'grab'
            },
            onclick: {
                enable: true,
                mode: 'push'
            },
            resize: true
        }
    },
    retina_detect: true
});

// Terminal Functionality
const terminal = {
    input: document.querySelector('.terminal-input'),
    output: document.querySelector('.terminal-output'),
    history: [],
    historyIndex: -1,
    isFirstOutput: true,
    hasLoaded: false,

    commands: {
        help: () => `Available commands:
- help: Show this help message
- about: Learn more about me
- skills: List my technical skills
- contact: Get my contact information
- clear: Clear the terminal
- projects: List my projects
- github: Open my GitHub profile
- welcome: Display welcome message`,

        about: () => `Hi! I'm Noah Dorfman, a Computer Engineer from Georgia Tech with expertise in embedded systems, software development, and hardware design. 

                    Currently doing device validation at Flock Safety. Previously, I worked at EM Photonics on advanced video signal processing and led software development of environmental controls for solid state radar at Lockheed Martin.
        
I specialize in developing efficient solutions across the full stack, from embedded systems to high-level software applications.`,

        contact: () => `📧 Email: n.dorfman00@gmail.com
🔗 LinkedIn: linkedin.com/in/noahdorfman
🐙 GitHub: https://github.com/NoahDorfman00
𝕏 X: x.com/noahdorfman`,

        clear: () => {
            terminal.output.innerHTML = '';
            return '';
        },

        github: () => {
            window.open('https://github.com/NoahDorfman00', '_blank');
            return 'Opening GitHub profile...';
        },

        welcome: () => `Welcome to The Ark! 👋
Type 'help' to see available commands.

Try these commands:
- 'about' to learn about me
- 'skills' to see my technical skills
- 'projects' to view my work`
    },

    execute(command) {
        const cmd = command.toLowerCase().trim();
        const output = this.commands[cmd] ? this.commands[cmd]() : `Command not found: ${command}. Type 'help' for available commands.`;

        this.addToOutput(`visitor@ark:~/noahs_portfolio$ ${command}`);
        this.addToOutput(output);

        this.history.push(command);
        this.historyIndex = this.history.length;
        this.input.value = '';

        // Ensure the input line is visible, but skip on initial load
        const inputLine = document.querySelector('.terminal-input-line');
        if (inputLine) {
            if (this.hasLoaded) {
                inputLine.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                this.hasLoaded = true;
            }
        }
    },

    addToOutput(text) {
        const div = document.createElement('div');
        div.textContent = text;
        this.output.appendChild(div);

        // Ensure the terminal container stays in place
        const terminalSection = document.querySelector('.terminal-section');
        const currentScroll = window.scrollY;

        // Only auto-scroll if not the first output (i.e., not on initial load)
        if (!this.isFirstOutput) {
            this.output.scrollTop = this.output.scrollHeight;
        } else {
            this.isFirstOutput = false;
        }

        // Restore page scroll position
        window.scrollTo(0, currentScroll);
    }
};

// Project data
const projects = [
    {
        title: "CoD: Black Ops 7 - Race to Master Prestige Leaderboard",
        description: "Computer vision based web application that scans popular streamers' gameplay and displays their progress to master prestige in a leaderboard.",
        technologies: ["OpenCV", "Python", "Firebase", "Tesseract OCR", "EasyOCR", "JavaScript", "HTML/CSS"],
        image: "https://theraceboard.com/social.png?1234",
        github: "https://github.com/NoahDorfman00/raceToPrestigeTracker",
        demo: "https://theraceboard.com/"
    },
    {
        title: "Claudio",
        description: "Italian-American AI companion, built as a web application with Google Firebase Functions backend and Anthropic AI integration.",
        technologies: ["HTML/CSS", "JavaScript", "Firebase", "Anthropic API"],
        image: "https://claudio.noahgdorfman.com/assets/social.png?1234",
        github: "https://github.com/NoahDorfman00/claudio",
        demo: "https://claudio.noahgdorfman.com/"
    },
    {
        title: "Flashcard Generator",
        description: "React web application with Google Firebase backend (Authentication, Realtime Database, and Functions) and Anthropic AI integration for generating flashcards of any topic.",
        technologies: ["React", "Firebase", "Anthropic API", "TypeScript"],
        image: "https://study.noahgdorfman.com/assets/social.png?1234",
        github: "https://github.com/NoahDorfman00/flashcards",
        demo: "https://study.noahgdorfman.com/"
    },
    {
        title: "all roads",
        description: "Web application that uses Google Maps API to find the shortest route between all of your friends, helping you find the perfect meeting place.",
        technologies: ["HTML/CSS", "JavaScript", "Google Maps API"],
        image: "https://allroads.noahgdorfman.com/assets/social.png?1234",
        github: "https://github.com/NoahDorfman00/allRoads",
        demo: "https://allroads.noahgdorfman.com"
    },
    {
        title: "liftbook",
        description: "React Native application with Google Firebase backend for simplified tracking of weightlifting progress. Premium subscription add-on with AI powered analytics.",
        technologies: ["React Native", "Firebase", "JavaScript"],
        image: "https://liftbookapp.com/assets/images/social.png?1234",
        github: "https://github.com/NoahDorfman00/liftbook",
        demo: "https://apps.apple.com/us/app/liftbook-strength-log/id6755925820"
    },
    {
        title: "FIT 9to5",
        description: "Web suite of tools for lifestyle coaching business. Simple macronutrient calculator and Stripe-based subscription management.",
        technologies: ["React", "Firebase", "TypeScript", "Stripe", "Google Firebase"],
        image: "https://fit9to5.com/assets/social.png?1234",
        github: "https://github.com/NoahDorfman00/fit9to5",
        demo: "https://fit9to5.com"
    },
    {
        title: "Saving Starman",
        description: "Designed and implemented a secure IoT network for real-time data collection, focusing on zero-trust principles. Demonstrated system security through practical hacking scenarios.",
        technologies: ["Embedded Systems", "C++"],
        image: "assets/starmanThumb.png",
        github: "https://github.com/NoahDorfman00/ece2035-mbed-rpg",
        demo: "https://youtu.be/H5QuszITFQo"
    }
];

// Skills Data Structure
const skillCategories = {
    'Software': [
        { name: 'C++', icon: '⚡' },
        { name: 'C', icon: '💻' },
        { name: 'Cuda', icon: '🎮' },
        { name: 'Java', icon: '☕' },
        { name: 'Python', icon: '🐍' },
        { name: 'Bash', icon: '🖥️' },
        { name: 'LLM Prompts', icon: '🤖' },
        { name: 'Linux', icon: '🐧' },
        { name: 'Android', icon: '📱' },
        { name: 'React Native', icon: '⚛️' },
        { name: 'HTML/CSS/JS', icon: '🌐' },
        { name: 'REST', icon: '🔌' },
        { name: 'Git', icon: '📦' }
    ],
    'Hardware': [
        { name: 'Embedded Systems', icon: '🔧' },
        { name: 'PCB Design', icon: '📟' },
        { name: 'Circuit Analysis', icon: '⚡' },
        { name: 'Soldering', icon: '🔨' },
        { name: 'Benchtop Equipment', icon: '🔬' },
        { name: 'Verilog', icon: '💾' },
        { name: 'FPGA', icon: '🎛️' }
    ],
    'Wetware': [
        { name: 'Project Management', icon: '📊' },
        { name: 'Agile', icon: '🔄' },
        { name: 'Technical Reports', icon: '📝' },
        { name: 'Datasheets', icon: '📑' },
        { name: 'Schematics', icon: '📐' },
        { name: 'Public Speaking', icon: '🎤' },
        { name: 'Logistics', icon: '🚚' }
    ]
};

// Add skills command to terminal after skillCategories is defined
terminal.commands.skills = () => {
    return Object.entries(skillCategories)
        .map(([category, skills]) =>
            `${category}:\n${skills.map(skill => `  ${skill.icon} ${skill.name}`).join('\n')}`)
        .join('\n\n');
};

// Add projects command to terminal after projects is defined
terminal.commands.projects = () => projects.map(project =>
    `${project.title}
└── ${project.description}
    ├── Technologies: ${project.technologies.join(', ')}
    ├── Demo: ${project.demo}
    └── GitHub: ${project.github}`
).join('\n\n');

// Initialize terminal
if (terminal.input && terminal.output) {
    // Add welcome message when terminal loads
    window.addEventListener('load', () => {
        terminal.execute('welcome');
    });

    // Handle mobile keyboard and scrolling
    terminal.input.addEventListener('focus', () => {
        // Wait for the keyboard to appear
        setTimeout(() => {
            const terminalContent = document.querySelector('.terminal-content');
            const inputLine = document.querySelector('.terminal-input-line');

            // Scroll the terminal content to show the input line
            if (terminalContent && inputLine) {
                terminalContent.scrollTop = terminalContent.scrollHeight;

                // Scroll the page to show the terminal
                const terminalSection = document.querySelector('.terminal-section');
                if (terminalSection) {
                    const rect = terminalSection.getBoundingClientRect();
                    const isVisible = (
                        rect.top >= 0 &&
                        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
                    );

                    if (!isVisible) {
                        inputLine.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        }, 500); // Delay to account for keyboard animation
    });

    // Terminal input handling
    terminal.input.addEventListener('keydown', (e) => {
        // Prevent page scrolling on arrow keys
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
        }

        if (e.key === 'Enter' && terminal.input.value.trim()) {
            e.preventDefault(); // Prevent page scroll on enter
            terminal.execute(terminal.input.value);
        } else if (e.key === 'ArrowUp') {
            if (terminal.historyIndex > 0) {
                terminal.historyIndex--;
                terminal.input.value = terminal.history[terminal.historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            if (terminal.historyIndex < terminal.history.length - 1) {
                terminal.historyIndex++;
                terminal.input.value = terminal.history[terminal.historyIndex];
            } else {
                terminal.historyIndex = terminal.history.length;
                terminal.input.value = '';
            }
        }
    });
}

// Dynamically populate projects
const projectGrid = document.querySelector('.project-grid');
if (projectGrid) {
    projects.forEach(project => {
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.setAttribute('data-aos', 'fade-up');

        projectCard.innerHTML = `
            <img src="${project.image}" alt="${project.title}" class="project-image">
            <div class="project-info">
                <h3>${project.title}</h3>
                <p>${project.description}</p>
                <div class="project-tech">
                    ${project.technologies.map(tech => `<span class="tech-tag">${tech}</span>`).join('')}
                </div>
                <div class="project-links">
                    <a href="${project.github}" target="_blank">
                        <i class="fab fa-github"></i> View Code
                    </a>
                    <a href="${project.demo}" target="_blank">
                        <i class="fas fa-external-link-alt"></i> Try it
                    </a>
                </div>
            </div>
        `;

        projectGrid.appendChild(projectCard);
    });
}

// Populate Skills Grid
const skillsGrid = document.querySelector('.skills-grid');
if (skillsGrid) {
    Object.entries(skillCategories).forEach(([category, skills]) => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'skill-category';

        categoryDiv.innerHTML = `
            <h3>${category}</h3>
            <div class="skill-list">
                ${skills.map(skill => `
                    <div class="skill-item">
                        <span class="skill-icon">${skill.icon}</span>
                        ${skill.name}
                    </div>
                `).join('')}
            </div>
        `;

        skillsGrid.appendChild(categoryDiv);
    });
}

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
}); 