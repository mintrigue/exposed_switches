

function windowH() {
   var wH = $(window).height();

   $('#container').css({height: wH});

}

windowH();


function PlayPage(){
	this.switchesActive = true;
	this.socket = null;
	this.gameRunning = true;
}

PlayPage.prototype.init = function(){
	var self = this;
	self.socket = io('/web');
	var clickEventType = ((document.ontouchstart!==null)?'click':'touchstart');
    $('.switch').bind(clickEventType, function(){

    	if(!self.switchesActive)
    		return;
	    if($(this).hasClass("on")){
	        $(this).removeClass("on");
	        $(this).attr("src", "/images/switch_off.png");
	        self.socket.emit('action', 'clicked_off');
	    } else {
	        $(this).addClass("on");
	        $(this).attr("src", "/images/switch_on.png");
	        self.resetIfNeeded();
	        self.socket.emit('action', 'clicked_on');
	    }
    });

    self.socket.on('count', function(msg){
    	$('#doneCount').html(msg.count);
    	$('#totalCount').html(msg.total);
    });

    self.socket.on('score', function(msg){
    	$('#score').html(msg);
    });

    self.socket.on('general_update', function(msg){
    	$('#doneCount').html(msg.done);
    	$('#totalCount').html(msg.total);

    	var tblRows = "";
    	$(msg.leaderboard).each(function(){
    		tblRows += "<tr><td>" + this.name + "</td><td>" + this.score + "</td></tr>";
    	});
    	$('#leaderboard').html(tblRows);
    });

    self.socket.on('rank_update', function(msg){
    	if(self.gameRunning){
    		$('#rank').html(msg.rank);
    		$('#player_count').html(msg.player_count);
    		$('#rank2').html(msg.rank);
    		$('#player_count2').html(msg.player_count);
    	}

    });

    self.socket.on('game_over', function(msg){
    	self.gameRunning = false;
    	$("#open_type").html(msg.winner_opentype);
    	$("#winner").html(msg.winner_handle);

    	var tblRows = "";
    	$(msg.leaderboard).each(function(){
    		tblRows += "<tr><td>" + this.name + "</td><td>" + this.score + "</td></tr>";
    	});
    	$("#leaderboard2").html(tblRows);

    	$('#playFrame').addClass("hidden");
    	$('#resultFrame').removeClass("hidden");
    	$("#voteBtn").addClass("hidden");
    });
}

PlayPage.prototype.resetIfNeeded = function(){
	var self = this;
	if($(".switch").length == $(".switch.on").length){
		self.switchesActive = false;

		$(".switches")
			.fadeOut(750, function(){
				$(".switch").removeClass("on");
				$(".switch").attr("src", "/images/switch_off.png");
			}).fadeIn(750, function(){
				self.switchesActive = true;
			});
	}
}

function BillboardPage(){
    this.socket = null;
    this.youtubeLoaded = false;
};

BillboardPage.prototype.init = function(){
    var self = this;
    self.socket = io('/web');

    self.socket.on('open_spiral', function(msg){
        $('#animationTitle').html(msg.open_type);
        var winningAnimation = null;
        switch(msg.open_type){
            case "NINJAS":
                winningAnimation = "BEtIoGQxqQs";
                break;
            case "RA!":
                winningAnimation = "dQw4w9WgXcQ";
                break;
            case "MOONWALK":
                winningAnimation = "gE1ZvCnwkYk";
                break;
            case "OUCH":
                winningAnimation = "dE-nfzcUiPk";
                break;
        }
        self.loadMovie(winningAnimation);
    });
};

BillboardPage.prototype.loadMovie = function(movieId){
    //Load player api asynchronously.
    $("#player").replaceWith("<div id='player'></div>");

    var tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    var firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    var done = false;
    var player;
    ytCallback = function() {
        player = new YT.Player('player', {
          height: '390',
          width: '640',
          videoId: movieId,
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
          }
        });
    }
    function onPlayerReady(evt) {
        evt.target.playVideo();
    }
    function onPlayerStateChange(evt) {
        if (evt.data == YT.PlayerState.PAUSED)
            $("#player").replaceWith("<div id='player'></div>");

    }
    function stopVideo() {
        player.stopVideo();

    }

    if(self.youtubeLoaded){
        ytCallback();
    }
    self.youtubeLoaded = true;
};

var ytCallback = null;
function onYouTubeIframeAPIReady() {
    ytCallback();
}

function RaspiPage(){
    this.socket = null;
};

RaspiPage.prototype.init = function(){
    var self = this;
    self.socket = io('/raspi');

    self.socket.on('power', function(msg){
        $("#currentLevel").html(msg.level);
        $("#totalLevel").html(msg.top_level);
    });

    self.socket.on('animation', function(msg){
        $("#timeLabel").html(new Date());
        $("#animationRequest").html("open with " + msg.open_animation + "<br>stay open for " + msg.duration + "seconds<br> close with "+ msg.close_animation);
    });

    $(".piConfigBtn").click(function(evt){
        evt.preventDefault();
        var key = $("#key").val();
        if(key.trim() == null)
            return alert("key required");

        var open_animations = $("#open").val().split(",");
        var close_animations = $("#close").val().split(",");

        self.socket.emit("pi_config", {open_animations:open_animations, close_animations:close_animations, key:key});
    });


    $(".stateChangeBtn").click(function(evt){
        evt.preventDefault();
        var key = $("#key").val();
        if(key.trim() == null)
            return alert("key required");

        self.socket.emit("state_change", {state:$(this).data("stateVal"), key:key});
    });

    $("#stayOpenBtn").click(function(evt){
        evt.preventDefault();
        var key = $("#key").val();
        if(key.trim() == null)
            return alert("key required");

        self.socket.emit("requesting_stay_open", {key:key, duration:parseInt($("#openDuration").val()), close_animation:$("#closeAnimation").val()});
    });

};


