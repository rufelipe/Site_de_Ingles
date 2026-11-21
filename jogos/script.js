async function loadGameStudentProfile() {
  const nameEl = document.getElementById('game-student-name');
  const avatarEl = document.getElementById('game-avatar');
  if (!nameEl || !avatarEl) return;
  try {
    const [meResult, settingsResult] = await Promise.all([
      fetch('../api/auth/me', { credentials: 'same-origin' }),
      fetch('../api/settings', { credentials: 'same-origin' })
    ]);
    if (!meResult.ok) return;
    const me = await meResult.json();
    const settings = settingsResult.ok ? (await settingsResult.json()).settings || {} : {};
    const fullName = me.user?.name || me.user?.username || 'Aluno';
    const firstName = fullName.trim().split(/\s+/)[0] || 'Aluno';
    nameEl.textContent = firstName;
    if (settings.avatar) {
      avatarEl.textContent = '';
      avatarEl.style.backgroundImage = 'url("' + settings.avatar.replace(/"/g, '%22') + '")';
      avatarEl.classList.add('has-photo');
    } else {
      const style = settings.avatarStyle || {};
      avatarEl.textContent = firstName.charAt(0).toUpperCase();
      avatarEl.style.setProperty('--avatar-skin', style.skin || '#d99b72');
      avatarEl.style.setProperty('--avatar-hair', style.hair || '#392638');
      avatarEl.style.setProperty('--avatar-clothes', style.clothes || '#8e58cc');
      avatarEl.classList.add('generated');
    }
  } catch {
    nameEl.textContent = 'Aluno';
  }
}

loadGameStudentProfile();
let assignedLessonQuestions = [];
let assignedLessonPhrases = [];
let currentGameQuestion = null;

function buildQuestionsFromAssignedLessons(lessons) {
  const generated = [];
  assignedLessonPhrases = [];
  (lessons || []).forEach((lesson) => {
    const sourceParts = [lesson.title, lesson.description, ...(lesson.notes || []).map((note) => note.content || '')];
    const text = sourceParts.join('. ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    const sentences = text.split(/[.!?\n]+/).map((part) => part.replace(/\s+/g, ' ').trim()).filter((part) => part.length >= 18);
    sentences.forEach((sentence) => {
      const phraseWords = sentence.match(/\S+/g) || [];
      if (phraseWords.length >= 4 && phraseWords.length <= 18) {
        assignedLessonPhrases.push({
          prompt: 'Organize a frase da lição "' + lesson.title + '":',
          answer: phraseWords,
          words: phraseWords.slice().sort(() => Math.random() - 0.5),
          lessonId: lesson.id
        });
      }
      const words = sentence.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [];
      if (words.length < 4) return;
      const target = words[Math.min(words.length - 1, Math.max(1, Math.floor(words.length / 2)))];
      const choices = [...new Set([target, ...words.filter((word) => word.toLowerCase() !== target.toLowerCase())])].slice(0, 4);
      if (choices.length < 2) return;
      const fallbacks = ['learn', 'practice', 'improve', 'understand'];
      while (choices.length < 4) choices.push(fallbacks[choices.length - 1]);
      const shuffled = choices.slice().sort(() => Math.random() - 0.5);
      generated.push({
        category: 'Sua lição · ' + (lesson.level || 'personalizado'),
        prompt: 'Complete a frase da lição "' + lesson.title + '": ' + sentence.replace(target, '_____'),
        choices: shuffled,
        answer: target,
        explanation: 'Esta palavra foi retirada do conteúdo da sua lição: ' + lesson.title + '.',
        lessonId: lesson.id
      });
    });
  });
  return generated;
}

async function loadAssignedLessonContent() {
  try {
    const response = await fetch('../api/games/content', { credentials: 'same-origin' });
    if (!response.ok) return;
    const data = await response.json();
    assignedLessonQuestions = buildQuestionsFromAssignedLessons(data.lessons || []);
    if (data.stats) {
      xp = Number(data.stats.xp) || 0;
      correctAnswers = Number(data.stats.correct_answers) || 0;
      streak = Number(data.stats.streak) || 0;
      localStorage.setItem(storageKeys.xp, String(xp));
      localStorage.setItem(storageKeys.answers, String(correctAnswers));
      localStorage.setItem(storageKeys.streak, String(streak));
      updateDashboard();
    }
    if (assignedLessonQuestions.length) {
      const note = document.createElement('p');
      note.className = 'section-note';
      note.textContent = assignedLessonQuestions.length + ' desafios personalizados gerados a partir das suas lições.';
      document.querySelector('.games-section .section-heading')?.appendChild(note);
    }
  } catch (error) {
    console.warn('Não foi possível carregar o conteúdo das lições.', error);
  }
}

async function saveGameAttempt(correct, points, lessonId = null) {
  try {
    await fetch('../api/games/attempts', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, correct, xpEarned: points, lessonId: lessonId || currentGameQuestion?.lessonId || null })
    });
  } catch (error) {
    console.warn('Não foi possível sincronizar o progresso do jogo.', error);
  }
}


const questionSets = {
  vocabulary: [
    { category: 'Vocabulário · cotidiano', prompt: 'O que significa “cozy”?', choices: ['Aconchegante', 'Barulhento', 'Distante', 'Apimentado'], answer: 'Aconchegante', explanation: 'Cozy descreve um lugar confortável e acolhedor.' },
    { category: 'Vocabulário · cotidiano', prompt: 'O que significa “to borrow”?', choices: ['Emprestar (pegar emprestado)', 'Esquecer', 'Construir', 'Escolher'], answer: 'Emprestar (pegar emprestado)', explanation: 'To borrow é pegar algo emprestado de alguém.' },
    { category: 'Vocabulário · cotidiano', prompt: 'Complete: “I’m ___ of my progress!”', choices: ['proud', 'thirsty', 'late', 'empty'], answer: 'proud', explanation: 'Proud significa orgulhoso(a): “Tenho orgulho do meu progresso!”' },
    { category: 'Vocabulário · cotidiano', prompt: 'Qual palavra significa “melhorar”?', choices: ['improve', 'invite', 'imagine', 'include'], answer: 'improve', explanation: 'Improve significa melhorar ou aprimorar.' }
  ],
  grammar: [
    { category: 'Gramática · present simple', prompt: 'She ___ English every day.', choices: ['study', 'studies', 'studying', 'studied'], answer: 'studies', explanation: 'Com he, she ou it no presente simples, normalmente acrescentamos -s ao verbo.' },
    { category: 'Gramática · verbo to be', prompt: 'They ___ happy today.', choices: ['is', 'am', 'are', 'be'], answer: 'are', explanation: 'Usamos are com they, we e you.' },
    { category: 'Gramática · artigos', prompt: 'I ate ___ apple after lunch.', choices: ['a', 'an', 'the', '—'], answer: 'an', explanation: 'Usamos an antes de um som de vogal, como em apple.' },
    { category: 'Gramática · passado', prompt: 'Yesterday, we ___ a movie.', choices: ['watch', 'watches', 'watched', 'watching'], answer: 'watched', explanation: 'Para muitos verbos regulares no passado, acrescentamos -ed.' }
  ]
};

const writingChallenges = {
  translation: [
    { category: 'Tradução · do português para o inglês', prompt: 'Traduza: “Eu estou aprendendo inglês todos os dias.”', audioPrompt: 'Eu estou aprendendo inglês todos os dias.', language: 'pt-BR', answer: 'I am learning English every day.', accepted: ["I'm learning English every day.", 'I learn English every day.'] },
    { category: 'Tradução · do português para o inglês', prompt: 'Traduza: “Ela gosta de ouvir música.”', audioPrompt: 'Ela gosta de ouvir música.', language: 'pt-BR', answer: 'She likes listening to music.', accepted: ['She likes to listen to music.'] },
    { category: 'Tradução · do português para o inglês', prompt: 'Traduza: “Nós estamos prontos para começar.”', audioPrompt: 'Nós estamos prontos para começar.', language: 'pt-BR', answer: 'We are ready to start.', accepted: ["We're ready to start."] }
  ],
  question: [
    { category: 'Perguntas · compreensão e conversação', prompt: 'What is the capital of France?', audioPrompt: 'What is the capital of France?', language: 'en-US', answer: 'Paris.', accepted: ['The capital of France is Paris.', 'It is Paris.'] },
    { category: 'Perguntas · compreensão e conversação', prompt: 'How many days are there in a week?', audioPrompt: 'How many days are there in a week?', language: 'en-US', answer: 'There are seven days in a week.', accepted: ['Seven.', 'Seven days.', 'There are 7 days in a week.'] },
    { category: 'Perguntas · compreensão e conversação', prompt: 'Which planet do we live on?', audioPrompt: 'Which planet do we live on?', language: 'en-US', answer: 'We live on Earth.', accepted: ['Earth.', 'The Earth.', 'We live on planet Earth.'] }
  ]
};

const phrases = [
  { prompt: 'Organize as palavras para dizer: “Eu gosto de aprender inglês.”', answer: ['I', 'like', 'learning', 'English.'], words: ['learning', 'English.', 'I', 'like'] },
  { prompt: 'Organize as palavras para dizer: “Ela pratica todos os dias.”', answer: ['She', 'practices', 'every', 'day.'], words: ['every', 'She', 'day.', 'practices'] },
  { prompt: 'Organize as palavras para dizer: “Nós podemos fazer isso!”', answer: ['We', 'can', 'do', 'it!'], words: ['do', 'it!', 'We', 'can'] }
];

const ranks = ['Iniciante', 'Explorador', 'Comunicador', 'Fluente'];

const difficultyQuestionSets = {
  vocabulary: [
    [
      { category: 'Vocabulário · nível 1', prompt: 'O que significa “cat”?', choices: ['Gato', 'Cachorro', 'Casa', 'Livro'], answer: 'Gato', explanation: 'Cat significa gato.' },
      { category: 'Vocabulário · nível 1', prompt: 'O que significa “happy”?', choices: ['Feliz', 'Cansado', 'Pequeno', 'Frio'], answer: 'Feliz', explanation: 'Happy significa feliz.' },
      { category: 'Vocabulário · nível 1', prompt: 'Complete: “Good ___!” (Bom dia!)', choices: ['morning', 'night', 'bye', 'thanks'], answer: 'morning', explanation: 'Good morning significa bom dia.' }
    ],
    [
      { category: 'Vocabulário · nível 2', prompt: 'O que significa “borrow”?', choices: ['Pegar emprestado', 'Esquecer', 'Construir', 'Escolher'], answer: 'Pegar emprestado', explanation: 'Borrow é pegar algo emprestado.' },
      { category: 'Vocabulário · nível 2', prompt: 'Qual é o oposto de “cheap”?', choices: ['Expensive', 'Easy', 'Quiet', 'Early'], answer: 'Expensive', explanation: 'Expensive significa caro, o oposto de cheap.' },
      { category: 'Vocabulário · nível 2', prompt: '“I’m proud of you” significa:', choices: ['Tenho orgulho de você', 'Estou esperando por você', 'Preciso de você', 'Estou preocupado com você'], answer: 'Tenho orgulho de você', explanation: 'Proud significa orgulhoso.' }
    ],
    [
      { category: 'Vocabulário · nível 3', prompt: 'O que significa “although”?', choices: ['Embora', 'Portanto', 'Além disso', 'Enquanto'], answer: 'Embora', explanation: 'Although introduz uma ideia de contraste: embora.' },
      { category: 'Vocabulário · nível 3', prompt: '“She eventually found her keys.” O que significa eventually?', choices: ['Finalmente', 'Raramente', 'Imediatamente', 'Talvez'], answer: 'Finalmente', explanation: 'Eventually significa finalmente, depois de algum tempo.' },
      { category: 'Vocabulário · nível 3', prompt: 'Qual palavra significa “evitar”?', choices: ['Avoid', 'Allow', 'Achieve', 'Attend'], answer: 'Avoid', explanation: 'Avoid significa evitar.' }
    ],
    [
      { category: 'Vocabulário · nível 4', prompt: 'O que significa “reluctant”?', choices: ['Relutante', 'Entusiasmado', 'Confiável', 'Distraído'], answer: 'Relutante', explanation: 'Reluctant descreve alguém que hesita ou não está disposto.' },
      { category: 'Vocabulário · nível 4', prompt: '“The evidence was compelling.” Compelling significa:', choices: ['Convincente', 'Confuso', 'Incompleto', 'Improvável'], answer: 'Convincente', explanation: 'Compelling significa convincente ou muito persuasivo.' },
      { category: 'Vocabulário · nível 4', prompt: 'Qual é o sentido de “to overlook a detail”?', choices: ['Deixar passar um detalhe', 'Explicar um detalhe', 'Acrescentar um detalhe', 'Procurar um detalhe'], answer: 'Deixar passar um detalhe', explanation: 'Overlook pode significar não perceber algo.' }
    ],
    [
      { category: 'Vocabulário · nível 5', prompt: 'O que significa “meticulous”?', choices: ['Muito cuidadoso e detalhista', 'Impaciente e apressado', 'Fácil de convencer', 'Pouco confiável'], answer: 'Muito cuidadoso e detalhista', explanation: 'Meticulous descreve alguém extremamente cuidadoso com detalhes.' },
      { category: 'Vocabulário · nível 5', prompt: '“The policy is aimed at mitigating risks.” Mitigating significa:', choices: ['Reduzindo a gravidade', 'Criando novos', 'Ignorando completamente', 'Calculando o custo'], answer: 'Reduzindo a gravidade', explanation: 'Mitigate significa reduzir ou atenuar algo negativo.' },
      { category: 'Vocabulário · nível 5', prompt: 'Qual palavra significa “inevitável”?', choices: ['Inevitable', 'Unaware', 'Adequate', 'Reluctant'], answer: 'Inevitable', explanation: 'Inevitable significa que não pode ser evitado.' }
    ]
  ],
  grammar: [
    [
      { category: 'Gramática · nível 1', prompt: 'I ___ a student.', choices: ['am', 'is', 'are', 'be'], answer: 'am', explanation: 'Usamos am com I.' },
      { category: 'Gramática · nível 1', prompt: 'They ___ happy.', choices: ['are', 'is', 'am', 'be'], answer: 'are', explanation: 'Usamos are com they.' },
      { category: 'Gramática · nível 1', prompt: 'Escolha o plural de “book”.', choices: ['books', 'bookes', 'bookies', 'book'], answer: 'books', explanation: 'Na maioria dos substantivos, acrescentamos -s.' }
    ],
    [
      { category: 'Gramática · nível 2', prompt: 'She ___ English every day.', choices: ['study', 'studies', 'studying', 'studied'], answer: 'studies', explanation: 'Com she no presente simples, acrescentamos -s ou -es.' },
      { category: 'Gramática · nível 2', prompt: 'I ate ___ apple.', choices: ['an', 'a', 'the', '—'], answer: 'an', explanation: 'Usamos an antes de som de vogal.' },
      { category: 'Gramática · nível 2', prompt: 'He ___ to work by bus.', choices: ['goes', 'go', 'going', 'gone'], answer: 'goes', explanation: 'Na terceira pessoa do singular, go vira goes.' }
    ],
    [
      { category: 'Gramática · nível 3', prompt: 'If it ___ tomorrow, we’ll stay home.', choices: ['rains', 'will rain', 'rained', 'is rain'], answer: 'rains', explanation: 'Na oração com if do primeiro condicional, usamos presente simples.' },
      { category: 'Gramática · nível 3', prompt: 'I have lived here ___ 2020.', choices: ['since', 'for', 'during', 'from'], answer: 'since', explanation: 'Since acompanha o ponto inicial de um período.' },
      { category: 'Gramática · nível 3', prompt: 'This book is ___ than the last one.', choices: ['more interesting', 'most interesting', 'interesting', 'the more interesting'], answer: 'more interesting', explanation: 'Usamos more + adjetivo longo + than para comparações.' }
    ],
    [
      { category: 'Gramática · nível 4', prompt: 'The emails ___ before the meeting started.', choices: ['had been sent', 'have sent', 'were sending', 'are sent'], answer: 'had been sent', explanation: 'O past perfect passive indica uma ação concluída antes de outra no passado.' },
      { category: 'Gramática · nível 4', prompt: 'She suggested ___ earlier.', choices: ['leaving', 'to leave', 'leave', 'left'], answer: 'leaving', explanation: 'Depois de suggest, usamos o gerúndio (-ing).' },
      { category: 'Gramática · nível 4', prompt: 'The person ___ called you is my colleague.', choices: ['who', 'which', 'whose', 'where'], answer: 'who', explanation: 'Who retoma pessoas em uma oração relativa.' }
    ],
    [
      { category: 'Gramática · nível 5', prompt: 'Had I known about the delay, I ___ earlier.', choices: ['would have left', 'will leave', 'would leave', 'left'], answer: 'would have left', explanation: 'A inversão Had I known equivale ao terceiro condicional.' },
      { category: 'Gramática · nível 5', prompt: 'Not only ___ the deadline, but she also exceeded expectations.', choices: ['did she meet', 'she met', 'has met she', 'she did meet'], answer: 'did she meet', explanation: 'Not only no início exige inversão entre auxiliar e sujeito.' },
      { category: 'Gramática · nível 5', prompt: 'The proposal, ___ details remain confidential, was approved.', choices: ['whose', 'which', 'that', 'who'], answer: 'whose', explanation: 'Whose indica posse e pode retomar coisas.' }
    ]
  ]
};

const difficultyWritingChallenges = {
  translation: [
    [
      { category: 'Tradução · nível 1', prompt: 'Traduza: “Eu gosto de café.”', audioPrompt: 'Eu gosto de café.', language: 'pt-BR', answer: 'I like coffee.', accepted: ['I love coffee.'] },
      { category: 'Tradução · nível 1', prompt: 'Traduza: “Ela é minha amiga.”', audioPrompt: 'Ela é minha amiga.', language: 'pt-BR', answer: 'She is my friend.', accepted: ["She's my friend."] }
    ],
    [
      { category: 'Tradução · nível 2', prompt: 'Traduza: “Eu estou aprendendo inglês todos os dias.”', audioPrompt: 'Eu estou aprendendo inglês todos os dias.', language: 'pt-BR', answer: 'I am learning English every day.', accepted: ["I'm learning English every day."] },
      { category: 'Tradução · nível 2', prompt: 'Traduza: “Ela gosta de ouvir música.”', audioPrompt: 'Ela gosta de ouvir música.', language: 'pt-BR', answer: 'She likes listening to music.', accepted: ['She likes to listen to music.'] }
    ],
    [
      { category: 'Tradução · nível 3', prompt: 'Traduza: “Embora estivesse cansado, ele terminou o trabalho.”', audioPrompt: 'Embora estivesse cansado, ele terminou o trabalho.', language: 'pt-BR', answer: 'Although he was tired, he finished the work.', accepted: ['Though he was tired, he finished the work.'] },
      { category: 'Tradução · nível 3', prompt: 'Traduza: “Nós já tínhamos saído quando ela ligou.”', audioPrompt: 'Nós já tínhamos saído quando ela ligou.', language: 'pt-BR', answer: 'We had already left when she called.', accepted: [] }
    ],
    [
      { category: 'Tradução · nível 4', prompt: 'Traduza: “Se eu soubesse a resposta, teria contado a você.”', audioPrompt: 'Se eu soubesse a resposta, teria contado a você.', language: 'pt-BR', answer: 'If I had known the answer, I would have told you.', accepted: ["Had I known the answer, I would have told you."] },
      { category: 'Tradução · nível 4', prompt: 'Traduza: “O relatório será revisado antes de ser publicado.”', audioPrompt: 'O relatório será revisado antes de ser publicado.', language: 'pt-BR', answer: 'The report will be reviewed before it is published.', accepted: [] }
    ],
    [
      { category: 'Tradução · nível 5', prompt: 'Traduza: “A decisão, por mais difícil que tenha sido, acabou beneficiando a equipe.”', audioPrompt: 'A decisão, por mais difícil que tenha sido, acabou beneficiando a equipe.', language: 'pt-BR', answer: 'The decision, difficult as it was, ultimately benefited the team.', accepted: ['Although the decision was difficult, it ultimately benefited the team.'] },
      { category: 'Tradução · nível 5', prompt: 'Traduza: “Pouco sabíamos que aquela conversa mudaria nossos planos.”', audioPrompt: 'Pouco sabíamos que aquela conversa mudaria nossos planos.', language: 'pt-BR', answer: 'Little did we know that conversation would change our plans.', accepted: [] }
    ]
  ],
  question: [
    [
      { category: 'Perguntas · nível 1', prompt: 'What color is the sky on a clear day?', audioPrompt: 'What color is the sky on a clear day?', language: 'en-US', answer: 'Blue.', accepted: ['It is blue.', 'The sky is blue.'] },
      { category: 'Perguntas · nível 1', prompt: 'How many days are there in a week?', audioPrompt: 'How many days are there in a week?', language: 'en-US', answer: 'There are seven days in a week.', accepted: ['Seven.', 'Seven days.'] }
    ],
    [
      { category: 'Perguntas · nível 2', prompt: 'What is the capital of France?', audioPrompt: 'What is the capital of France?', language: 'en-US', answer: 'Paris.', accepted: ['The capital of France is Paris.', 'It is Paris.'] },
      { category: 'Perguntas · nível 2', prompt: 'Which planet do we live on?', audioPrompt: 'Which planet do we live on?', language: 'en-US', answer: 'We live on Earth.', accepted: ['Earth.', 'The Earth.'] }
    ],
    [
      { category: 'Perguntas · nível 3', prompt: 'Why do people usually use an umbrella?', audioPrompt: 'Why do people usually use an umbrella?', language: 'en-US', answer: 'People use an umbrella to stay dry in the rain.', accepted: ['To stay dry.', 'To protect themselves from the rain.'] },
      { category: 'Perguntas · nível 3', prompt: 'What would you do if you missed your bus?', audioPrompt: 'What would you do if you missed your bus?', language: 'en-US', answer: 'I would take the next bus.', accepted: ['I would wait for the next bus.'] }
    ],
    [
      { category: 'Perguntas · nível 4', prompt: 'How might working remotely benefit a team?', audioPrompt: 'How might working remotely benefit a team?', language: 'en-US', answer: 'It can give team members more flexibility.', accepted: ['It may give people more flexibility.'] },
      { category: 'Perguntas · nível 4', prompt: 'What should a city consider before expanding public transport?', audioPrompt: 'What should a city consider before expanding public transport?', language: 'en-US', answer: 'It should consider demand, cost, and environmental impact.', accepted: ['Demand, cost, and environmental impact.'] }
    ],
    [
      { category: 'Perguntas · nível 5', prompt: 'How can a company balance innovation with responsible use of data?', audioPrompt: 'How can a company balance innovation with responsible use of data?', language: 'en-US', answer: 'It can innovate while protecting privacy and being transparent about data use.', accepted: ['By protecting privacy and being transparent about data use.'] },
      { category: 'Perguntas · nível 5', prompt: 'Why might a short-term solution create long-term challenges?', audioPrompt: 'Why might a short-term solution create long-term challenges?', language: 'en-US', answer: 'It may solve an immediate problem while creating new costs or risks later.', accepted: ['It may solve an immediate problem but create future costs or risks.'] }
    ]
  ]
};

const difficultyPhrases = [
  [
    { prompt: 'Organize: “Eu gosto de livros.”', answer: ['I', 'like', 'books.'], words: ['books.', 'I', 'like'] },
    { prompt: 'Organize: “Ela está feliz.”', answer: ['She', 'is', 'happy.'], words: ['happy.', 'She', 'is'] }
  ],
  [
    { prompt: 'Organize: “Eu gosto de aprender inglês.”', answer: ['I', 'like', 'learning', 'English.'], words: ['learning', 'English.', 'I', 'like'] },
    { prompt: 'Organize: “Ela pratica todos os dias.”', answer: ['She', 'practices', 'every', 'day.'], words: ['every', 'She', 'day.', 'practices'] }
  ],
  [
    { prompt: 'Organize: “Embora estivesse chovendo, fomos caminhar.”', answer: ['Although', 'it', 'was', 'raining,', 'we', 'went', 'for', 'a', 'walk.'], words: ['went', 'Although', 'a', 'we', 'raining,', 'for', 'it', 'walk.', 'was'] },
    { prompt: 'Organize: “Ela tem estudado desde janeiro.”', answer: ['She', 'has', 'been', 'studying', 'since', 'January.'], words: ['since', 'She', 'studying', 'January.', 'has', 'been'] }
  ],
  [
    { prompt: 'Organize: “O projeto foi concluído antes do prazo.”', answer: ['The', 'project', 'was', 'completed', 'ahead', 'of', 'schedule.'], words: ['completed', 'The', 'ahead', 'project', 'of', 'was', 'schedule.'] },
    { prompt: 'Organize: “Se tivéssemos saído antes, teríamos chegado a tempo.”', answer: ['If', 'we', 'had', 'left', 'earlier,', 'we', 'would', 'have', 'arrived', 'on', 'time.'], words: ['arrived', 'If', 'we', 'on', 'had', 'time.', 'left', 'would', 'earlier,', 'have', 'we'] }
  ],
  [
    { prompt: 'Organize: “Raramente uma descoberta mudou tantas perspectivas.”', answer: ['Rarely', 'has', 'a', 'discovery', 'changed', 'so', 'many', 'perspectives.'], words: ['changed', 'Rarely', 'many', 'has', 'perspectives.', 'a', 'so', 'discovery'] },
    { prompt: 'Organize: “Por mais convincente que pareça, a proposta exige análise.”', answer: ['Convincing', 'as', 'it', 'may', 'seem,', 'the', 'proposal', 'requires', 'careful', 'analysis.'], words: ['proposal', 'Convincing', 'careful', 'as', 'requires', 'it', 'analysis.', 'the', 'may', 'seem,'] }
  ]
];

function getProgress() {
  const stage = (correctAnswers % 100) + 1;
  return { level: Math.floor(correctAnswers / 100) + 1, stage, difficulty: Math.floor((stage - 1) / 20) + 1 };
}
const storageKeys = { xp: 'linguaplay-xp', answers: 'linguaplay-answers', streak: 'linguaplay-streak', active: 'linguaplay-last-active' };
const savedNumber = (key) => Number(localStorage.getItem(key)) || 0;
let xp = savedNumber(storageKeys.xp);
let correctAnswers = savedNumber(storageKeys.answers);
let streak = savedNumber(storageKeys.streak);
let mode = 'vocabulary';
let questionIndex = 0;
let phraseIndex = 0;
let writingIndex = 0;
let selectedWords = [];
let selectedRecognition = null;
let answered = false;

const gameArea = document.getElementById('gameArea');
const rewardAmount = document.getElementById('rewardAmount');

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function updateStreak() {
  const today = localDateKey(new Date());
  const previous = localStorage.getItem(storageKeys.active);
  if (previous !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    streak = previous === localDateKey(yesterday) ? streak + 1 : 1;
    localStorage.setItem(storageKeys.active, today);
    localStorage.setItem(storageKeys.streak, streak);
  }
}

function updateDashboard() {
  const progress = getProgress();
  const rankName = ranks[(progress.level - 1) % ranks.length];
  document.getElementById('xpCount').textContent = xp;
  document.getElementById('answerCount').textContent = correctAnswers;
  document.getElementById('streakCount').textContent = streak;
  document.getElementById('rankName').textContent = `${rankName} ${progress.level}`;
  document.getElementById('stageText').textContent = `Etapa ${progress.stage} de 100`;
  document.getElementById('rankProgress').style.width = `${((progress.stage - 1) / 100) * 100}%`;
  document.getElementById('nextRankText').textContent = `Dificuldade ${progress.difficulty} de 5 · aumenta a cada 20 etapas`;
}

function award(points) {
  xp += points;
  correctAnswers += 1;
  updateStreak();
  localStorage.setItem(storageKeys.xp, xp);
  localStorage.setItem(storageKeys.answers, correctAnswers);
  updateDashboard();
  saveGameAttempt(true, points);
}

function speak(text, language) {
  if (!('speechSynthesis' in window)) {
    setAudioStatus('A reprodução de áudio não está disponível neste navegador.');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find((voice) => voice.lang.toLowerCase() === language.toLowerCase())
    || voices.find((voice) => voice.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
}

function setAudioStatus(message) {
  const status = document.getElementById('audioStatus');
  if (status) status.textContent = message;
}

function normalizeAnswer(text) {
  return text.toLocaleLowerCase('en-US')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

function renderWritingChallenge() {
  const progress = getProgress();
  const challenges = difficultyWritingChallenges[mode][progress.difficulty - 1];
  const challenge = challenges[writingIndex % challenges.length];
  const isTranslation = mode === 'translation';
  answered = false;
  rewardAmount.textContent = '+15';
  gameArea.innerHTML = `
    <div class="game-content">
      <span class="game-category">${challenge.category} · etapa ${progress.stage}/100</span>
      <h3>${isTranslation ? 'Escreva ou fale a tradução' : 'Ouça e responda em inglês'}</h3>
      <p class="question-hint">${challenge.prompt}</p>
      <div class="audio-actions">
        <button class="audio-button" id="playPrompt" type="button">🔊 Ouvir ${isTranslation ? 'frase' : 'pergunta'}</button>
        <button class="audio-button" id="recordAnswer" type="button">🎙️ Responder por voz</button>
        <button class="audio-button" id="playAnswer" type="button">🔊 Ouvir resposta-modelo</button>
      </div>
      <label class="sr-only" for="writtenAnswer">Sua resposta em inglês</label>
      <textarea class="answer-input" id="writtenAnswer" placeholder="Digite sua resposta em inglês…" autocomplete="off"></textarea>
      <p class="audio-status" id="audioStatus" aria-live="polite">Você pode digitar ou usar o microfone. A resposta-modelo também pode ser ouvida.</p>
      <button class="check-button" id="checkWriting" type="button">Conferir resposta</button>
      <p class="feedback" id="feedback" aria-live="polite">Uma resposta certa vale 15 XP.</p>
    </div>`;
  document.getElementById('playPrompt').addEventListener('click', () => speak(challenge.audioPrompt, challenge.language));
  document.getElementById('playAnswer').addEventListener('click', () => speak(challenge.answer, 'en-US'));
  document.getElementById('checkWriting').addEventListener('click', () => checkWritingAnswer(challenge));
  setupSpeechRecognition();
}

function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const button = document.getElementById('recordAnswer');
  if (!SpeechRecognition) {
    button.disabled = true;
    setAudioStatus('O reconhecimento de voz não é compatível com este navegador. Você ainda pode digitar e ouvir o áudio.');
    return;
  }
  button.addEventListener('click', () => {
    if (selectedRecognition) {
      selectedRecognition.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    selectedRecognition = recognition;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    button.textContent = '⏹️ Parar gravação';
    setAudioStatus('Ouvindo… fale sua resposta em inglês.');
    recognition.onresult = (event) => {
      document.getElementById('writtenAnswer').value = event.results[0][0].transcript;
      setAudioStatus('Resposta reconhecida. Confira o texto e envie quando estiver pronto.');
    };
    recognition.onerror = (event) => {
      const message = event.error === 'not-allowed'
        ? 'O acesso ao microfone foi bloqueado. Verifique a permissão do navegador.'
        : 'Não foi possível reconhecer a voz. Tente novamente ou digite sua resposta.';
      setAudioStatus(message);
    };
    recognition.onend = () => {
      selectedRecognition = null;
      const currentButton = document.getElementById('recordAnswer');
      if (currentButton) currentButton.textContent = '🎙️ Responder por voz';
    };
    try {
      recognition.start();
    } catch (error) {
      selectedRecognition = null;
      button.textContent = '🎙️ Responder por voz';
      setAudioStatus('Não foi possível iniciar o microfone. Tente novamente ou digite sua resposta.');
    }
  });
}

function checkWritingAnswer(challenge) {
  if (answered) return;
  const input = document.getElementById('writtenAnswer');
  const response = normalizeAnswer(input.value);
  const expected = [challenge.answer, ...challenge.accepted].map(normalizeAnswer);
  const feedback = document.getElementById('feedback');
  if (!response) {
    feedback.className = 'feedback bad';
    feedback.textContent = 'Digite ou fale uma resposta antes de conferir.';
    input.focus();
    return;
  }
  if (expected.includes(response)) {
    answered = true;
    award(15);
    input.disabled = true;
    document.getElementById('checkWriting').disabled = true;
    feedback.className = 'feedback good';
    feedback.textContent = `Muito bem! A resposta-modelo é: ${challenge.answer} +15 XP`;
    setAudioStatus('Toque em “Ouvir resposta-modelo” para escutar a pronúncia.');
    addNextButton();
  } else {
    feedback.className = 'feedback bad';
    feedback.textContent = `Ainda não. Resposta-modelo: ${challenge.answer} Você pode tentar novamente.`;
  }
}

function renderQuiz() {
  const progress = getProgress();
  const set = difficultyQuestionSets[mode][progress.difficulty - 1];
  const questionPool = assignedLessonQuestions.length ? [...set, ...assignedLessonQuestions] : set;
  const question = questionPool[questionIndex % questionPool.length];
  currentGameQuestion = question;
  answered = false;
  rewardAmount.textContent = '+10';
  gameArea.innerHTML = `
    <div class="game-content">
      <span class="game-category">${question.category} · etapa ${progress.stage}/100</span>
      <h3>Responda e ganhe XP!</h3>
      <p class="question-hint">Escolha a alternativa correta para continuar sua jornada.</p>
      <p class="question-word">${question.prompt}</p>
      <div class="options-grid">${question.choices.map((choice, index) => `<button class="option-button" type="button" data-choice="${index}">${choice}</button>`).join('')}</div>
      <p class="feedback" id="feedback" aria-live="polite">Uma resposta certa vale 10 XP.</p>
    </div>`;
  gameArea.querySelectorAll('.option-button').forEach((button) => {
    button.addEventListener('click', () => checkQuizAnswer(button, question));
  });
}

function checkQuizAnswer(button, question) {
  if (answered) return;
  const feedback = document.getElementById('feedback');
  if (question.choices[Number(button.dataset.choice)] === question.answer) {
    answered = true;
    button.classList.add('correct');
    gameArea.querySelectorAll('.option-button').forEach((option) => { option.disabled = true; });
    award(10);
    feedback.className = 'feedback good';
    feedback.textContent = `Muito bem! ${question.explanation} +10 XP`;
    addNextButton();
  } else {
    saveGameAttempt(false, 0, question.lessonId);
    button.classList.add('incorrect');
    button.disabled = true;
    feedback.className = 'feedback bad';
    feedback.textContent = 'Quase! Tente outra alternativa. Você consegue!';
  }
}

function addNextButton() {
  const button = document.createElement('button');
  button.className = 'next-button';
  button.type = 'button';
  button.textContent = mode === 'sentence' ? 'Próxima frase →' : 'Próximo desafio →';
  button.addEventListener('click', () => {
    if (mode === 'sentence') {
      phraseIndex = (phraseIndex + 1) % phrases.length;
      selectedWords = [];
      renderPhrase();
    } else if (mode === 'translation' || mode === 'question') {
      writingIndex += 1;
      renderWritingChallenge();
    } else {
      questionIndex += 1;
      renderQuiz();
    }
  });
  gameArea.querySelector('.game-content').appendChild(button);
}

function renderPhrase() {
  const progress = getProgress();
  const set = difficultyPhrases[progress.difficulty - 1];
  const phrasePool = assignedLessonPhrases.length ? [...set, ...assignedLessonPhrases] : set;
  const phrase = phrasePool[phraseIndex % phrasePool.length];
  currentGameQuestion = phrase;
  selectedWords = [];
  answered = false;
  rewardAmount.textContent = '+15';
  gameArea.innerHTML = `
    <div class="game-content">
      <span class="game-category">Desafio · construção de frases · nível ${progress.difficulty}</span>
      <h3>Coloque as palavras em ordem</h3>
      <p class="question-hint">${phrase.prompt}</p>
      <div class="phrase-target" id="phraseTarget" aria-label="Sua frase"></div>
      <div class="word-bank" id="wordBank">${phrase.words.map((word, index) => `<button class="word-chip" type="button" data-word="${index}">${word}</button>`).join('')}</div>
      <p class="feedback" id="feedback" aria-live="polite">Toque nas palavras na ordem correta. Vale 15 XP.</p>
      <button class="check-button" id="checkPhrase" type="button">Conferir frase</button>
    </div>`;
  gameArea.querySelectorAll('.word-chip').forEach((button) => {
    button.addEventListener('click', () => selectWord(button, phrase));
  });
  document.getElementById('checkPhrase').addEventListener('click', () => checkPhrase(phrase));
}

function selectWord(button, phrase) {
  if (answered || button.disabled) return;
  const index = Number(button.dataset.word);
  selectedWords.push({ index, word: phrase.words[index] });
  button.disabled = true;
  const chip = document.createElement('button');
  chip.className = 'word-chip';
  chip.type = 'button';
  chip.textContent = phrase.words[index];
  chip.setAttribute('aria-label', `Remover ${phrase.words[index]}`);
  chip.addEventListener('click', () => {
    selectedWords = selectedWords.filter((item) => item.index !== index);
    button.disabled = false;
    chip.remove();
  });
  document.getElementById('phraseTarget').appendChild(chip);
}

function checkPhrase(phrase) {
  if (answered) return;
  const feedback = document.getElementById('feedback');
  const isCorrect = selectedWords.length === phrase.answer.length && selectedWords.every((item, index) => item.word === phrase.answer[index]);
  if (isCorrect) {
    answered = true;
    award(15);
    feedback.className = 'feedback good';
    feedback.textContent = 'Frase perfeita! Você está construindo confiança. +15 XP';
    gameArea.querySelectorAll('.word-chip').forEach((button) => { button.disabled = true; });
    document.getElementById('checkPhrase').disabled = true;
    addNextButton();
  } else {
    feedback.className = 'feedback bad';
    feedback.textContent = 'Ainda não está na ordem certa. Toque em uma palavra da frase para removê-la e tente de novo.';
  }
}

document.querySelectorAll('.game-card').forEach((card) => {
  card.addEventListener('click', () => {
    document.querySelector('.game-card.active').classList.remove('active');
    card.classList.add('active');
    mode = card.dataset.mode;
    questionIndex = 0;
    phraseIndex = 0;
    writingIndex = 0;
    if (mode === 'sentence') renderPhrase();
    else if (mode === 'translation' || mode === 'question') renderWritingChallenge();
    else renderQuiz();
  });
});

updateDashboard();
loadAssignedLessonContent().finally(() => renderQuiz());
