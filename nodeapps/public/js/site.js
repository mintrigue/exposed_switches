

function windowH() {
   var wH = $(window).height();

   $('#container').css({height: wH});

}

windowH();


function PlayPage(){
	this.switchesActive = true;
	this.socket = null;
}

PlayPage.prototype.init = function(){
	var self = this;
	self.socket = io();
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
    	$('#rank').html(msg.rank);
    	$('#player_count').html(msg.player_count);

    });

    self.socket.on('game_over', function(msg){
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

