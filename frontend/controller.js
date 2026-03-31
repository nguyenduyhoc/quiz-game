/**
 * QuizController
 *
 * Manages the entire quiz flow:
 *   1. Generate / retrieve a persistent userId from localStorage.
 *   2. Fetch a question from GET /question.
 *   3. Record the time the question was displayed.
 *   4. On answer click → POST /answer → show result + next level.
 *   5. Player clicks "Next Question" → repeat from step 2.
 */
angular.module('quizApp').controller('QuizController', ['$scope', '$http', function ($scope, $http) {

  // ── Config ─────────────────────────────────────────────────────────────────
  // Dùng URL tương đối để hoạt động cả trên localhost lẫn server triển khai.
  // Vì Express phục vụ frontend trên cùng port, gọi '/question' là đủ.
  var API = '';

  // Persist a unique userId across page refreshes using localStorage
  var userId = localStorage.getItem('quizUserId');
  if (!userId) {
    userId = 'player_' + Date.now();
    localStorage.setItem('quizUserId', userId);
  }

  // ── Scope state ────────────────────────────────────────────────────────────
  $scope.loading         = false;
  $scope.currentQuestion = null;  // Question object from GET /question
  $scope.answered        = false; // Whether the player has clicked an answer
  $scope.isCorrect       = false;
  $scope.selectedAnswer  = null;
  $scope.currentLevel    = 1;
  $scope.score           = 0;     // Total correct answers
  $scope.accuracy        = 50;    // Running accuracy percentage
  $scope.levelMessage    = '';    // Text shown after each answer
  $scope.levelClass      = '';    // CSS class: 'up' | 'down' | ''

  var questionStartTime = null;   // Timestamp (ms) when question was shown

  // ── loadQuestion ───────────────────────────────────────────────────────────

  /**
   * Fetch a new question from the backend.
   * Resets all answer-related state before making the request.
   */
  $scope.loadQuestion = function () {
    $scope.loading        = true;
    $scope.answered       = false;
    $scope.selectedAnswer = null;
    $scope.levelMessage   = '';
    $scope.levelClass     = '';

    $http.get(API + '/question', { params: { userId: userId } })
      .then(function (res) {
        $scope.currentQuestion = res.data;
        $scope.currentLevel    = res.data.currentLevel;
        $scope.accuracy        = res.data.accuracy;
        $scope.score           = res.data.score;
        $scope.loading         = false;

        // Record the exact moment the question appears on screen
        questionStartTime = Date.now();
      })
      .catch(function (err) {
        console.error('Failed to load question:', err);
        $scope.loading = false;
      });
  };

  // ── submitAnswer ───────────────────────────────────────────────────────────

  /**
   * Called when the player clicks one of the four answer buttons.
   *
   * @param {string} answer  The option the player selected
   */
  $scope.submitAnswer = function (answer) {
    if ($scope.answered) return; // Guard against double-clicks

    // Calculate how long the player took to answer (in milliseconds)
    var responseTime = Date.now() - questionStartTime;

    $scope.selectedAnswer = answer;
    $scope.answered       = true; // Disable buttons immediately

    $http.post(API + '/answer', {
      userId:         userId,
      questionId:     $scope.currentQuestion.id,
      selectedAnswer: answer,
      responseTime:   responseTime
    })
      .then(function (res) {
        var data = res.data;

        $scope.isCorrect = data.isCorrect;
        $scope.accuracy  = data.accuracy;
        $scope.score     = data.score;

        // Reveal the correct answer so the template can highlight it
        $scope.currentQuestion.correctAnswer = data.correctAnswer;

        // Build the level-change message and style
        var oldLevel = $scope.currentLevel;
        $scope.currentLevel = data.nextLevel;

        if (data.nextLevel > oldLevel) {
          $scope.levelMessage = '🎉 Level Up! You moved to Level ' + data.nextLevel;
          $scope.levelClass   = 'up';
        } else if (data.nextLevel < oldLevel) {
          $scope.levelMessage = '📉 Level Down. Keep practising at Level ' + data.nextLevel;
          $scope.levelClass   = 'down';
        } else {
          $scope.levelMessage = 'Staying at Level ' + data.nextLevel + ' (avg time: ' + data.avgTime + ' ms)';
          $scope.levelClass   = '';
        }
      })
      .catch(function (err) {
        console.error('Failed to submit answer:', err);
      });
  };

  // ── Boot ───────────────────────────────────────────────────────────────────

  // Automatically load the first question when the controller initialises
  $scope.loadQuestion();

}]);
