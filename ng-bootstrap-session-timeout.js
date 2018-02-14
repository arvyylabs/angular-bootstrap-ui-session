(function (angular) {
  'use strict';

  angular
    .module('ngBootstrapSessionTimeout', ["ui.bootstrap"])
    .directive('bootstrapSessionTimeout', BootstrapSessionTimeoutDirective)
    .controller('BootstrapSessionTimeoutModalController', BootstrapSessionTimeoutModalController);;

  BootstrapSessionTimeoutDirective.$inject = [];
  function BootstrapSessionTimeoutDirective() {
    // Usage:
    //
    // Creates:
    //
    var directive = {
      bindToController: true,
      controller: BootstrapSessionTimeoutController,
      controllerAs: 'bus',
      link: link,
      restrict: 'E',
      scope: {
        options: '='
      }
    };
    return directive;

    function link(scope, element, attrs) { }

  }

  /* @ngInject */
  BootstrapSessionTimeoutController.$inject = ['$scope', '$document', '$http', '$timeout', '$uibModal'];
  function BootstrapSessionTimeoutController($scope, $document, $http, $timeout, $uibModal) {

    var vm = this;
    var defaults = {
      title: 'Your Session is About to Expire!',
      message: 'Your session is about to expire.',
      logoutButton: 'Logout',
      keepAliveButton: 'Stay Connected',
      keepAliveUrl: '/keep-alive',
      ajaxType: 'POST',
      ajaxData: '',
      redirUrl: '/timed-out',
      logoutUrl: '/log-out',
      warnAfter: 900000, // 15 minutes
      redirAfter: 1200000, // 20 minutes
      keepAliveInterval: 5000,
      keepAlive: true,
      ignoreUserActivity: false,
      onStart: false,
      onWarn: false,
      onRedir: false,
      countdownMessage: false,
      countdownBar: false,
      countdownSmart: false
    };

    var timer = null;
    var countdown = {};
    var opt = defaults;
    var modalInstance = null;

    if (vm.options) {
      opt = angular.extend(defaults, vm.options);
    }

    function openModal() {

      modalInstance = $uibModal.open({
        animation: true,
        template: '<div class="modal-content"><div class="modal-header"><h4>{{busm.options.title}}</h4></div><div class="modal-body"><p>{{busm.options.message}}</p><p ng-if="busm.options.countdownMessage"> {{busm.buildCountdownMessage(busm.countdown.timeLeft)}}</p><uib-progressbar ng-if="busm.options.countdownBar" class="progress-striped active" style="min-width:15px; width: 100%;" value="busm.countdown.percentLeft">{{busm.countdown.secText}}</uib-progressbar></div><div class="modal-footer"><button type="button" class="btn btn-default" ng-click="busm.logout()">{{busm.options.logoutButton}}</button><button type="submit" class="btn btn-primary" ng-click="busm.stayLoggedIn()">{{busm.options.keepAliveButton}}</button></div></div>',
        controller: 'BootstrapSessionTimeoutModalController',
        controllerAs: 'busm',
        resolve: {
          options: opt,
          countdown: countdown,
          redirectOptions: {
            redirect: redirect
          }
        }
      });
      modalInstance && modalInstance.result.then(successCb, failureCb);
      
      function successCb(result) {
        if(result) {
          startSessionTimer();
        }
      }

      function failureCb(result) { }
    }

    function closeModal() {

      modalInstance && modalInstance.close();

      $timeout(function () {
        modalInstance = null;
      });
    }

    function redirect() {
      if (typeof opt.redirUrl === 'function') {
        window.location = opt.redirUrl();
      } else {
        window.location = opt.redirUrl;
      }
    }

    if (opt.warnAfter >= opt.redirAfter) {
      throw new Error('Bootstrap-session-timeout plugin is miss-configured. Option "redirAfter" must be equal or greater than "warnAfter".');
      return false;
    }

    if (!opt.ignoreUserActivity) {

      var mousePosition = [-1, -1];

      $document.on('keyup mouseup mousemove touchend touchmove', function (e) {
        if (e.type === 'mousemove') {
          // Solves mousemove even when mouse not moving issue on Chrome:
          // https://code.google.com/p/chromium/issues/detail?id=241476
          if (e.clientX === mousePosition[0] && e.clientY === mousePosition[1]) {
            return;
          }
          mousePosition[0] = e.clientX;
          mousePosition[1] = e.clientY;
        }

        startSessionTimer();

        // If they moved the mouse not only reset the counter
        // but remove the modal too!
        closeModal();
      });
    }

    // Keeps the server side connection live, by pingin url set in keepAliveUrl option.
    // KeepAlivePinged is a helper var to ensure the functionality of the keepAliveInterval option
    var keepAlivePinged = false;

    function keepAlive() {

      if (!keepAlivePinged) {
        
        var keepAliveUrl = undefined;
        if (typeof opt.keepAliveUrl === 'function') {
          keepAliveUrl = opt.keepAliveUrl();
        } else {
          keepAliveUrl = opt.keepAliveUrl;
        }
        
        // Ping keepalive URL using (if provided) data and type from options
        $http({
          method: opt.ajaxType,
          url: keepAliveUrl,
          data: opt.ajaxData
        });
        keepAlivePinged = true;

        $timeout(function () {
          keepAlivePinged = false;
        }, opt.keepAliveInterval);
      }
    }

    function startSessionTimer() {
      // Clear session timer
      $timeout.cancel(timer);
      if (opt.countdownMessage || opt.countdownBar) {
        startCountdownTimer('session', true);
      }

      if (typeof opt.onStart === 'function') {
        opt.onStart(opt);
      }

      // If keepAlive option is set to "true", ping the "keepAliveUrl" url
      if (opt.keepAlive) {
        keepAlive();
      }

      // Set session timer
      timer = $timeout(function () {
        // Check for onWarn callback function and if there is none, launch dialog
        if (typeof opt.onWarn !== 'function') {
          openModal();
        } else {
          opt.onWarn(opt);
        }
        // Start dialog timer
        startDialogTimer();
      }, opt.warnAfter);
    }

    function startDialogTimer() {
      // Clear session timer
      $timeout.cancel(timer);

      if (!modalInstance && (opt.countdownMessage || opt.countdownBar)) {
        // If warning dialog is not already open and either opt.countdownMessage
        // or opt.countdownBar are set start countdown
        startCountdownTimer('dialog', true);
      }

      // Set dialog timer
      timer = $timeout(function () {
        // Check for onRedir callback function and if there is none, launch redirect
        if (typeof opt.onRedir !== 'function') {
          redirect()
        } else {
          opt.onRedir(opt);
        }
      }, (opt.redirAfter - opt.warnAfter));

    }

    function startCountdownTimer(type, reset) {

      // Clear countdown timer
      $timeout.cancel(countdown.timer);

      if (type === 'dialog' && reset) {
        // If triggered by startDialogTimer start warning countdown
        countdown.timeLeft = Math.floor((opt.redirAfter - opt.warnAfter) / 1000);
      } else if (type === 'session' && reset) {
        // If triggered by startSessionTimer start full countdown
        // (this is needed if user doesn't close the warning dialog)
        countdown.timeLeft = Math.floor(opt.redirAfter / 1000);
      }
      var percentLeft = 0;
      // If opt.countdownBar is true, calculate remaining time percentage
      if (opt.countdownBar && type === 'dialog') {
        countdown.percentLeft = Math.floor(countdown.timeLeft / ((opt.redirAfter - opt.warnAfter) / 1000) * 100);
      } else if (opt.countdownBar && type === 'session') {
        countdown.percentLeft = Math.floor(countdown.timeLeft / (opt.redirAfter / 1000) * 100);
      }
      // Set countdown message time value
      var secondsLeft = countdown.timeLeft >= 0 ? countdown.timeLeft : 0;
      if (opt.countdownSmart) {
        var minLeft = Math.floor(secondsLeft / 60);
        var secRemain = secondsLeft % 60;
        var countTxt = minLeft > 0 ? minLeft + 'm' : '';
        if (countTxt.length > 0) {
          countTxt += ' ';
        }
        countTxt += secRemain + 's';
        countdown.secText = countTxt;
      } else {
        countdown.secText = secondsLeft + "s";
      }

      // Countdown by one second
      countdown.timeLeft = countdown.timeLeft <= 0 ? 0 : (countdown.timeLeft - 1);
      countdown.timer = $timeout(function () {
        // Call self after one second
        startCountdownTimer(type);
      }, 1000);
    }

    // Start session timer
    startSessionTimer();

    $scope.$on("$destroy", function (event) {
      $timeout.cancel(timer);
    });

  }

  BootstrapSessionTimeoutModalController.$inject = ['$uibModalInstance', 'options', 'countdown', 'redirectOptions'];
  function BootstrapSessionTimeoutModalController($uibModalInstance, options, countdown, redirectOptions) {
    var vm = this;
    var firstZero = false;
    vm.options = options;
    vm.countdown = countdown;

    vm.logout = logout;
    vm.stayLoggedIn = stayLoggedIn;
    vm.buildCountdownMessage = buildCountdownMessage;

    ////////////////


    function buildCountdownMessage(time) { 
      var displayTime = 0;
      if(time === 0) {
        if(!firstZero) {
          displayTime = time + 1;
        }
        firstZero = true;
      } else {
        displayTime = time + 1;
      }
      return vm.options.countdownMessage.replace('{timer}', displayTime);
    }

    function stayLoggedIn() {
      $uibModalInstance.close(true);
    }

    function logout() {
      redirectOptions.redirect();
    }
  }

})(angular);
