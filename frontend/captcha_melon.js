function Captcha(useYn){
    this.init(useYn);
}

Captcha.prototype.use       = false;
Captcha.dataKey             = 'chkcapt';
Captcha.failCountKey        = 'captchaFailCount';
Captcha.checkDomStorageMsg  = '인증예매를 사용하시려면 브라우저 설정을 변경해주세요.\tInternet Explorer의 설정 -> 인터넷옵션 -> \'고급\' 탭 -> \'보안＇ 항목 중 "DOM 저장소 사용" 항목을 선택하여 주세요.';

/**
 * 인증예매(캡챠) 초기화
 *
 * @param useYn
 */
Captcha.prototype.init = function(useYn) {
    if (useYn == 'Y') this.use = true;
    if (!this.use) return;

    // IE 대응 (브라우저 옵션중 'DOM 저장소' 옵션 미사용으로 되어 있을 경우 경고)
    Captcha.checkDomStorageIE(this.use);
    // 인증예매(캡챠) 인증완료여부 체크
    this.checkState(this.use);
    // 이벤트
    this.action(this.use);
}

/**
 * 인증예매(캡챠) 인증완료여부 체크
 *
 * @param captchaUse
 */
Captcha.prototype.checkState = function(captchaUse) {
    if (!captchaUse) return;

    if (Captcha.getData() != '' && Captcha.getData() != 'N' && Captcha.getData() != null) {
        var captchaObjTemp = this;
        var captStr = (Captcha.getData() == null || Captcha.getData() == '')?$('#captchaEncStr').val():Captcha.getData();
        $.ajax({
            type : 'POST',
            url  : '/reservation/ajax/checkCaptchaComplete.json',
            data : {
                    'chkcapt' 	: captStr,
                    'prodId' 	: $("#prodId").val()
            },
            success : function(res){
                if (res.CODE == '0000') captchaObjTemp.hide();
                else captchaObjTemp.show();
            },
            error:function(e){
                alert('요청사항을 처리중 오류가 발생했습니다.');
            }
        });
    }else{
        Captcha.setData('');
    }
}

/**
 * 인증예매(캡챠) 이벤트
 */
Captcha.prototype.action = function(captchaUse) {
    if (!captchaUse) return;

    this.actionReload();        // 새로고침
    this.actionAudio();         // 음성듣기
    this.actionComplete();      // 입력완료
    this.actionLater();         // '나중에하기'
    this.actionEnter();         // Enter Event
};

/**
 * 인증예매(캡챠) 새로고침 버튼 이벤트
 */
Captcha.prototype.actionReload = function() {
    if ($('#btnReload').length <= 0) return;

    $('#btnReload').click(function(){
        $.ajax({
            type : 'GET',
            url  : '/reservation/ajax/captChaImage.json?prodId=' + document.sForm.prodId.value + '&scheduleNo=' + document.sForm.scheduleNo.value + '&t=' + new Date().getTime(),
            success : function(result){
                $("#captchaImg").attr('src', 'data:image/png;base64,' + result.CAPTIMAGE);
                $('#captchaEncStr').val(result.CAPTDATA);
                Captcha.setData('');
                // 새로고침 시 실패 횟수 초기화
                Captcha.setFailCount(0);
            },
            error:function(e){
                alert('요청사항을 처리중 오류가 발생했습니다.');
            }
        });
    });
}

/**
 * 인증예매(캡챠) 음성듣기 버튼 이벤트
 */
Captcha.prototype.actionAudio = function() {
    if ($('#btnAudio').length <= 0) return;

    $('#btnAudio').click(function(){
        var captStr = (Captcha.getData() == null || Captcha.getData() == '')?$('#captchaEncStr').val():Captcha.getData();
        var soundUrl = '/reservation/ajax/captChaAudio.htm?chkcapt=' + encodeURIComponent(captStr) + '&nocache=' + new Date().getTime();
        if (Captcha.checkIE()) {
            $('#audioCaptcha').html(' <bgsound src="' + (soundUrl+'?agent=msie&rand='+ Math.random()) + '">');		// IE
        } else if (!!document.createElement('audio').canPlayType) {
            try {
//					new Audio(soundUrl).play();
                $('#audioCaptcha').html(' <audio autoplay><source src="' + soundUrl + '" type="audio/wav"></audio>');   // preload="auto" controls loop
            } catch(e) {
                $('#audioCaptcha').html(' <bgsound src="' + soundUrl + '">');
            }
        } else {
            window.open(soundUrl, '', 'width=1,height=1');
        }
    });
}

/**
 * 인증예매(캡챠) 입력완료 버튼 이벤트
 */
Captcha.prototype.actionComplete = function() {
    if ($('#btnComplete').length <= 0) return;

    $('#btnComplete').click({obj: this}, function(e) {
        e.preventDefault();
        e.data.obj.checkCaptcha();
    });
}

/**
 * 인증예매(캡챠) '좌석 먼저 보고 나중에 입력하기' 버튼 이벤트
 */
Captcha.prototype.actionLater = function() {
    if ($('#btn_later').length <= 0) return;

    $('#btn_later').click(function(event) {
        event.preventDefault();
        $("#certification").hide();
        $('#btn_later').text('좌석 선택 다시 하기');
    });
}

/**
 * 인증예매(캡챠) 입력박스 엔터키 이벤트
 */
Captcha.prototype.actionEnter = function() {
    if ($('#label-for-captcha').length <= 0) return;

    $('#label-for-captcha').keypress({obj: this}, function (e) {
        if (e.which == 13) e.data.obj.checkCaptcha();
    });
}

/**
 * 캡챠 이미지를 파일로 저장
 *
 * @param base64Image - Base64 인코딩된 이미지
 * @param captchaText - 캡챠 텍스트
 * @param hasFailed - 실패 여부
 */
Captcha.prototype.saveCaptchaImage = function(base64Image, captchaText, hasFailed) {
    // 파일명 생성 (실패 후 성공 시 "_F" 추가)
    var fileName = captchaText + (hasFailed ? '_F' : '') + '.png';
    
    // Base64를 Blob으로 변환
    var byteCharacters = atob(base64Image);
    var byteNumbers = new Array(byteCharacters.length);
    for (var i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    var byteArray = new Uint8Array(byteNumbers);
    var blob = new Blob([byteArray], { type: 'image/png' });
    
    // 다운로드 링크 생성 및 클릭
    var url = window.URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
};

/**
 *  인증예매(캡챠) '입력완료' 문자 체크
 */
Captcha.prototype.checkCaptcha = function() {
    if (!this.use) return;

    if( $('#label-for-captcha').val() == '' ){
        $('#label-for-captcha').css('border-color', '#e17f31');
        $('#errorMessage').show();
        $('#errorMessage').text('문자를 입력해 주세요');
        return;
    }

    var captStr = (Captcha.getData() == null || Captcha.getData() == '')?$('#captchaEncStr').val():Captcha.getData();
    var captchaObjTemp = this;
    
    $.ajax({
        type : 'POST',
        url  : '/reservation/ajax/checkCaptcha.json',
        data : {
            'userCaptStr'   : $('#label-for-captcha').val(),
            'chkcapt' 	    : captStr,
            'prodId'	 	: $('#prodId').val(),
            'scheduleNo' 	: $('#scheduleNo').val(),
            'pocCode'	 	: $('#pocCode').val(),
            'sellTypeCode'	: $('#sellTypeCode').val()
        },
        success : function(res){
            if (res.CODE == '0000') {
                // 실패 횟수 확인
                var failCount = Captcha.getFailCount();
                var hasFailed = failCount > 0;
                
                // 캡챠 이미지 저장 (성공 시에만)
                var captchaImageElement = $('#captchaImg');
                if (captchaImageElement.length > 0) {
                    var imgSrc = captchaImageElement.attr('src');
                    var base64Image = imgSrc.replace(/^data:image\/png;base64,/, '');
                    captchaObjTemp.saveCaptchaImage(base64Image, $('#label-for-captcha').val(), hasFailed);
                }
                
                // 입력값 초기화
                $('#label-for-captcha').val('');
                $('#label-for-captcha').css('border-color', '');
                $('#errorMessage').hide();
                
                // 실패 횟수 초기화
                Captcha.setFailCount(0);
                
                // 데이터 저장
                if (res.DATA != undefined) Captcha.setData(res.DATA);
                
                // 5초 뒤 리로드 (레이어는 닫지 않음)
                setTimeout(function() {
                    location.reload();
                }, 5000);
            }else{
                // 실패 횟수 증가
                var failCount = Captcha.getFailCount();
                Captcha.setFailCount(failCount + 1);
                
                $('#label-for-captcha').css('border-color', '#e17f31');
                $('#errorMessage').show();
                $('#errorMessage').text('문자를 정확히 입력해 주세요');
            }
        },
        error:function(e){
            alert('요청사항을 처리중 오류가 발생했습니다.');
        }
    });
}

/**
 * 인증예매(캡챠) 팝업 활성화
 */
Captcha.prototype.show = function(){
    if (!this.use) return;
    if ($('#certification').length > 0) $('#certification').show();
}

/**
 * 인증예매(캡챠) 팝업 비활성화
 */
Captcha.prototype.hide = function(){
    if (!this.use) return;
    if ($('#certification').length > 0) $('#certification').hide();
}

/**
 * sessionStorage 지원여부 체크
 *
 * @returns {boolean}
 */
Captcha.supportsStorage = function() {
    try {
       return 'sessionStorage' in window && window.sessionStorage !== null;
//         return !!window.sessionStorage;
    } catch (a) {
        return false;
    }
};

/**
 * 'DOM 저장소' 설정 여부 체크 (IE)
 *      - IE는 쿠키 사용, DOM 저장소  별도로 설정 가능
 */
Captcha.checkDomStorageIE = function(captchaUse) {
    if (!captchaUse) return;

    if (Captcha.checkIE() && !Captcha.supportsStorage())
        alert(Captcha.checkDomStorageMsg);
}

/**
 * 인증예매(캡챠) 완료여부값 Set
 *
 * @param dataValue
 */
Captcha.setData = function(dataValue) {
    if (Captcha.supportsStorage()) 
        sessionStorage.setItem(Captcha.dataKey, dataValue);
};

/**
 * 인증예매(캡챠) 완료여부값 Get
 *
 * @return dataValue
 */
Captcha.getData = function() {
    if (Captcha.supportsStorage()) {
        return sessionStorage.getItem(Captcha.dataKey);
    }else{
        return '';
    }
};

/**
 * 캡챠 실패 횟수 Set
 *
 * @param failCount
 */
Captcha.setFailCount = function(failCount) {
    if (Captcha.supportsStorage()) 
        sessionStorage.setItem(Captcha.failCountKey, failCount);
};

/**
 * 캡챠 실패 횟수 Get
 *
 * @return failCount
 */
Captcha.getFailCount = function() {
    if (Captcha.supportsStorage()) {
        var failCount = sessionStorage.getItem(Captcha.failCountKey);
        return failCount ? parseInt(failCount) : 0;
    }else{
        return 0;
    }
};

/**
 * IE Check
 *
 * @return boolean
 */
Captcha.checkIE = function() {
    var userAgentVal = navigator.userAgent;
    if (userAgentVal.indexOf('Trident') > -1 || userAgentVal.indexOf('MSIE') > -1 || userAgentVal.indexOf('Edge') > -1)
        return true;
    else
        return false;
};
