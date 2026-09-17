/* 시스템 설명 오버레이 — README(설계 문서, v3)를 흐름 그림으로 옮긴 10단계 워크스루.
   CDN·라이브러리 없이 HTML/CSS/SVG만 쓴다(허브 파드에서 외부 요청 없이 떠야 하므로).
   내용의 근거는 README.md 각 장이며, 수치·규칙 ID는 database/ 의 실제 행을 인용한다. */

(function () {
  const SEEN_KEY = "f1_guide_seen_v3";

  /* ── 단계 정의 ───────────────────────────────────────────────────────
     kicker: 상단 라벨 · title: 제목 · lead: 도입 문단 · art: 그림 · note: 마무리 강조 */
  const STEPS = [
    {
      nav: "왜 이 문제인가",
      kicker: "문제",
      title: "약을 만드는 과정에서, 제형 설계가 자주 터진다",
      lead: `새로운 약 하나를 세상에 내놓기까지 보통 <b>10년 이상, 수조 원</b>이 든다.
             약효를 내는 주성분을 찾아도 끝이 아니다. 사람이 삼킬 수 있는 형태 —
             정제·캡슐·시럽 — 로 만들어야 비로소 약이 되고, 이 단계를
             <b>제형(製劑) 설계</b>라고 부른다. 주성분 하나로는 알약이 굳지 않고 잘 녹지도 않으니
             첨가제를 섞고 녹이는 전략을 고르는데, <b>바로 그 선택에서 사고가 난다.</b>`,
      art: `
        <div class="f1-timeline f1-seq">
          <div class="f1-tl">후보물질 발굴<small>수천 개 중 극소수</small></div>
          <div class="f1-tl hot">제형 설계<small>← 여기</small></div>
          <div class="f1-tl">비임상<small>동물·독성</small></div>
          <div class="f1-tl">임상 1·2·3<small>수년</small></div>
          <div class="f1-tl">허가·생산<small>규제 심사</small></div>
        </div>
        <div class="f1-fails f1-seq">
          <div class="f1-box f1-fail"><b><span class="f1-emoji">⚗️</span>화학적 충돌</b>
            <span>주성분과 첨가제가 반응해 약이 갈변하거나 분해된다</span></div>
          <div class="f1-box f1-fail"><b><span class="f1-emoji">💧</span>전략 오판</b>
            <span>녹는 속도가 문제인 약에 녹는 양을 올리는 비싼 공정을 쓰거나, 그 반대를 한다</span></div>
          <div class="f1-box f1-fail"><b><span class="f1-emoji">📕</span>규제 초과</b>
            <span>나라별 첨가제 상한을 넘긴다. 어린이용은 기준이 훨씬 엄격하다</span></div>
        </div>`,
      note: `지금까지 제약 현장은 이 문제를 <b>실험실에서 직접 만들어 보고, 실패하면 다시 설계하는</b>
             방식으로 풀었다. 한 번의 실험에 드는 시간과 비용이 크고, 그 시행착오를 수십 번 반복한다.
             이 시행착오를 <b>컴퓨터 안에서 최대한 미리 끝내고, 꼭 필요한 실험만 골라 요청하자</b>는 것이 출발점이다.`,
    },

    {
      nav: "챗봇으론 안 되는 이유",
      kicker: "함정",
      title: "그럴듯하게 말하는 것과, 실제로 맞는 것은 다르다",
      lead: `"AI가 똑똑하니 좋은 처방을 물어보면 되지 않나?" 여기에 함정이 있다.
             거대언어모델은 <b>환각(hallucination)</b> — 존재하지 않는 사실을 자신 있게 지어내는 현상 —
             을 보인다. 일어나지 않는 화학 반응을 매끄럽게 설명하고, 만들 수 없는 처방을 태연히 제시하며,
             <b>규제 수치와 물성값까지 지어낸다.</b>`,
      art: `
        <div class="f1-versus f1-seq">
          <div class="f1-quote bad">
            <div class="f1-qhead">✕ LLM에게 통째로 맡기면</div>
            <div class="f1-said">"이 화합물의 용해도는 약 <b>0.2 mg/mL</b>로 충분합니다.
              미분화 정제로 가시면 됩니다."</div>
            <span class="f1-badge bad">환각</span>
            <span class="f1-badge soft">근거 없음</span>
            <div class="f1-cap">측정한 적 없는 값을 단정한다.
              그 값 하나에 전략 선택 전체가 걸려 있다.</div>
          </div>
          <div class="f1-quote good">
            <div class="f1-qhead">✓ 이 시스템은</div>
            <div class="f1-said f1-mono">logs_esol: −3.12 (Tm 미반영)<br>
              logs_gse: −4.25 (Tm 반영)<br>
              편차: 1.13 log ≥ 1.0<br>
              → bcs_class: 확정하지 않음<br>
              → 요청: DRQ_SOL · 평형용해도<br>
              source: Delaney 2004 · Jain 2001</div>
            <span class="f1-badge good">출처 추적됨</span>
            <span class="f1-badge good">모르면 묻는다</span>
            <div class="f1-cap">예측끼리 어긋나면 한쪽을 믿지 않고,
              어떤 실험이 필요한지 말한다.</div>
          </div>
        </div>`,
      note: `<b>창의적인 아이디어를 내는 능력</b>과 <b>그 아이디어가 맞는지 빈틈없이 검증하는 능력</b>,
             그리고 <b>모르는 것을 모른다고 말하는 정직함</b>은 서로 다른 일이다.
             뒤의 두 가지를 말 잘하는 AI에게 통째로 맡기는 것은 위험하다.`,
    },

    {
      nav: "핵심 아이디어",
      kicker: "설계 원칙",
      title: "창의는 AI가, 검증은 규칙이, 모르는 것은 실험이",
      lead: `역할을 나눴다. <b>새로운 처방을 상상하고 만드는 일은 AI에게</b>,
             <b>그것이 맞는지 검사하는 일은 "절대 틀리지 않는 규칙"에게</b>,
             <b>규칙이 판단할 값이 없을 때는 실험에게</b> 맡긴다.`,
      art: `
        <div class="f1-split f1-seq">
          <div class="f1-half ai">
            <h4>AI 에이전트가 하는 일</h4>
            <p>규칙만으로는 결코 할 수 없는 것</p>
            <ul>
              <li>고른 전략 안에서 쓸 만한 처방을 상상</li>
              <li>안정성·복용 편의·단가 사이의 타협점 찾기</li>
              <li>통과한 후보들의 상대적 우수도 평가</li>
            </ul>
          </div>
          <div class="f1-guard">
            <div>가드레일</div>
            <div class="bar"></div>
            <div>안에서<br>자유롭게</div>
          </div>
          <div class="f1-half rule">
            <h4>결정론적 규칙이 하는 일</h4>
            <p>AI의 추측이 끼어들면 위험한 것</p>
            <ul>
              <li>어떤 전략을 고를지 — 같은 입력이면 같은 계획</li>
              <li>금기·어린이 상한 같은 수치 판정 (오차 0%)</li>
              <li>어떤 실험을 요청할지, 후보를 믿어도 되는지</li>
            </ul>
          </div>
        </div>
        <div class="f1-cols c3 f1-seq" style="margin-top:14px">
          <div class="f1-box f1-det"><b>반려</b><span>룰북만 할 수 있다</span></div>
          <div class="f1-box f1-det"><b>신뢰도 태그</b><span>데이터 요청 계층만 정한다</span></div>
          <div class="f1-box f1-jud"><b>순위</b><span>심사관은 이것만 정한다</span></div>
        </div>`,
      note: `규칙은 "이건 틀렸어"까지만 말할 수 있고 새로운 답을 만들지는 못한다. AI는 답을 만들지만
             그 답이 맞는지는 보증하지 못한다. 그리고 둘 다 <b>측정하지 않은 값을 대신 알아낼 수는 없다</b> —
             그 빈칸은 실험 요청으로 채운다.`,
    },

    {
      nav: "전체 흐름 ★",
      kicker: "시스템 구조",
      title: "분자식 하나가 후보 처방 목록이 되기까지",
      lead: `에이전트 구성이 <b>고정돼 있지 않다.</b> 요청이 들어올 때마다 그 상황에 맞는 전략과
             전문가를 그때그때 골라 팀을 꾸린다. 그 선택은 AI가 아니라 <b>규칙표가 결정론적으로</b> 한다 —
             같은 입력이면 같은 계획이 나오고, 계획 자체가 감사 기록이 된다.`,
      art: `
        <div class="f1-arch f1-seq">
          <div class="f1-io">입력 · <b>SMILES + 용량</b>(필수) · 대상 환자 · 이미 가진 실측값(선택)</div>
          <div class="f1-flowmark">▼</div>

          <div class="f1-tier t3">
            <header><span>① 페이즈 게이트 — 어떤 전략이 맞는가</span><span>결정론 · LLM 0회</span></header>
            <div class="f1-sub">
              <div class="f1-pill-sm">파생값 (D0 · Tg 여유 · ΔpKa)</div>
              <div class="f1-pill-sm">BCS/DCS</div>
              <div class="f1-pill-sm">고체상</div>
              <div class="f1-pill-sm">가용화 신호</div>
              <div class="f1-pill-sm">ASD 공정</div>
              <div class="f1-pill-sm">공정 경로</div>
            </div>
          </div>
          <div class="f1-flowmark">▼ 실험 요청 ① 전략을 좁히는 값 — <b>막지 않고 진행</b></div>

          <div class="f1-tier t1">
            <header><span>② 계획</span><span>전략 가족 8종 · 점수식</span></header>
            <div class="f1-box f1-det"><b>상위 전략 ≤ 3개 선택 · 계획 서명 기록</b>
              <span>판정이 안 갈리면 좁히지 않고 양쪽 전략을 모두 연다</span></div>
          </div>
          <div class="f1-flowmark">▼</div>

          <div class="f1-tier t2">
            <header><span>③ 설계 — 전략별 병렬 후보</span><span>Generators</span></header>
            <div class="f1-cols c3">
              <div class="f1-box f1-llm"><b>후보 A</b><span>미분화 + 즉시방출 정제</span></div>
              <div class="f1-box f1-llm"><b>후보 B</b><span>분무건조 ASD → 건식과립 → 타정</span></div>
              <div class="f1-box f1-llm"><b>후보 C</b><span>자가유화 지질제형 캡슐</span></div>
            </div>
          </div>
          <div class="f1-flowmark">▼</div>

          <div class="f1-tier t3">
            <header><span>④ 규칙 게이트 — 금기가 있는가</span><span>결정론 · 반려 권한</span></header>
            <div class="f1-sub">
              <div class="f1-pill-sm">배합 금기</div>
              <div class="f1-pill-sm">어린이 안전</div>
              <div class="f1-pill-sm">공정 세부 · 배합비 · 잔류용매</div>
            </div>
          </div>
          <div class="f1-flowmark">▼ 통과한 후보만 · 실험 요청 ② 후보별 신뢰도</div>

          <div class="f1-tier t3">
            <header><span>⑤ 동적 심사위원단</span><span>상황따라 N명 · 반려 권한 없음</span></header>
            <div class="f1-sub">
              <div class="f1-pill-sm">💧 가용화 전략</div>
              <div class="f1-pill-sm">🏭 공정 실현성 · 항상</div>
              <div class="f1-pill-sm">🧊 고체상 안정성</div>
              <div class="f1-pill-sm dashed">… 조건 맞으면 추가 소집</div>
            </div>
          </div>
          <div class="f1-flowmark">▼ 합의 · 가중평균</div>

          <div class="f1-io win">★ 후보 처방 목록 — 성분 · 공정 단계 · 근거 · <b>grounded / provisional</b> · 남은 실험 요청</div>
          <div class="f1-cols c3" style="margin-top:2px">
            <div class="f1-loop">⟲ 규칙 반려 → 되돌림 규칙 → 반성 → ① 로</div>
            <div class="f1-loop">⟲ 측정값 제출 → 계획 같으면 재계산만</div>
            <div class="f1-loop">⟲ 계획이 바뀌면 → ③ 설계부터</div>
          </div>
        </div>`,
      note: `시스템은 <b>후보 처방 목록에서 끝난다.</b> 실행 프로토콜·포장 사양·승인 절차·배치 제조 이후는
             다루지 않는다 — 처방이 실행되지 않으면 그 단계들은 입력 자체가 없기 때문이다.
             대신 모든 후보에 <b>얼마나 믿어도 되는지</b>와 <b>무엇을 측정하면 확정되는지</b>가 붙는다.
             심사위원단에는 고정 명단이 없어서, 조건이 맞지 않는 심사관은 <b>아예 생성되지 않는다.</b>`,
    },

    {
      nav: "값의 세 계층 ★",
      kicker: "v3의 중심",
      title: "이 값은 계산한 것인가, 추정한 것인가, 잰 것인가",
      lead: `제형 판단에 쓰는 모든 값을 <b>어떻게 얻었는가</b>로 나눈다.
             이 구분이 곧 시스템의 작동 원리다 — <b>계산할 수 있는 것은 묻지 않고,
             잴 수밖에 없는 것만 묻는다.</b>`,
      art: `
        <div class="f1-cols c3 f1-seq">
          <div class="f1-box f1-det"><b>A · 계산값</b>
            <span>분자식에서 결정론적으로 나온다.<br>
              분자량 · cLogP · 극성표면적 · 회전가능결합 · 구조 패턴 82종</span>
            <span class="f1-badge good">확정 · 자동</span></div>
          <div class="f1-box"><b>B · 예측값</b>
            <span>A에 공개된 경험식을 적용한다.<br>
              ESOL · GSE 용해도 · ⅔ 경험칙 Tg</span>
            <span class="f1-badge soft">잠정 · *_est 변수에만</span></div>
          <div class="f1-box f1-det"><b>C · 실측값</b>
            <span>실험을 해야만 나온다.<br>
              XRPD · DSC · TGA · pKa · 평형용해도 · 투과도 · 강제분해</span>
            <span class="f1-badge good">확정 · 측정 후</span></div>
        </div>
        <div class="f1-policy f1-seq" style="margin-top:14px">
          <div class="f1-prow use"><span class="st">BCS 등급</span>
            <span class="to">→</span><span class="act"><b>실측으로만 확정</b> — 예측으로는 "잠정 저용해도"까지만 말한다</span></div>
          <div class="f1-prow prov"><span class="st">예측 vs 실측</span>
            <span class="to">→</span><span class="act">서로 다른 변수라 <b>공존한다</b> — 실측이 와도 예측은 보정 정보로 남는다</span></div>
          <div class="f1-prow down"><span class="st">무거운 예측 모델</span>
            <span class="to">→</span><span class="act">기본 구성에서 뺐다 — 경험식이 안 되면 <b>모델을 늘리지 않고 실측을 요청</b></span></div>
          <div class="f1-prow drop"><span class="st">모르는 값</span>
            <span class="to">→</span><span class="act"><b>기본값으로 채우지 않는다</b> — 투과도 인자를 1로 채우면 IIa가 수학적으로 불가능해진다</span></div>
        </div>`,
      note: `파생값도 코드가 아니라 <b>표의 식</b>이다(<code class="f1-mono">derived_quantities.csv</code> 23행).
             보수적 logS를 파이썬에서 미리 계산하게 짰더니 재료(ESOL·GSE)가 아직 없어서 값이 늘 비었고,
             아무 실측도 없는 상태에서 <b>전략이 하나도 생성되지 않았다.</b> 그 식을 표의 한 행으로 옮기자
             순서 문제가 사라졌다.`,
    },

    {
      nav: "입구: 분자 계산",
      kicker: "입력 계층",
      title: "필요한 건 분자식과 용량, 나머지는 계산한다",
      lead: `유당이 위험한지 아닌지는 <b>약에 아민기가 있느냐</b>에 달려 있고,
             어떤 가용화 전략이 맞는지는 <b>얼마나 녹느냐</b>에 달려 있다.
             사람이 손으로 적으면 틀린다. 그래서 <b>분자식(SMILES)에서 시작한다.</b>`,
      art: `
        <div class="f1-pipe f1-seq">
          <div>
            <div class="f1-smiles">SMILES<br>+ dose_mg</div>
            <div class="f1-cap" style="margin-top:7px">필수 입력은 이 둘뿐</div>
          </div>
          <div class="f1-branches">
            <div class="f1-branch"><span class="tick">├─</span>
              <div><b>구조 품질 검사</b>
                <span>파싱 · 염 제거(parent 추출) · 전하 · 입체중심</span></div></div>
            <div class="f1-branch"><span class="tick">├─</span>
              <div><b>분자 특성값 35종</b>
                <span>분자량 · cLogP · 극성표면적 · 방향족 비율 …</span></div></div>
            <div class="f1-branch"><span class="tick">├─</span>
              <div><b>구조 패턴 82종</b>
                <span>구조 사실 18 · 조건부 경고 52 · 높은 경고 12</span></div></div>
            <div class="f1-branch low"><span class="tick">└─</span>
              <div><b>폐쇄형 예측 (잠정)</b>
                <span>ESOL · GSE 용해도 → <b>BCS 등급 확정에는 쓰지 않음</b></span></div></div>
          </div>
        </div>
        <div class="f1-flagcmp f1-seq">
          <div class="f1-box">
            <b>가상 화합물 — 아미드</b>
            <div class="f1-flagline on"><i class="dot"></i>is_amide_not_amine</div>
            <div class="f1-flagline off"><i class="dot"></i>has_primary_amine</div>
            <div class="f1-flagline off"><i class="dot"></i>has_secondary_amine</div>
            <span>이름에 "아미노"가 들어가도 실제로는 <b>아미드</b>일 수 있다 — 반응할 유리 아민이 없다</span>
          </div>
          <div class="f1-box">
            <b>X3 — 2차 지방족 아민</b>
            <div class="f1-flagline off"><i class="dot"></i>is_amide_not_amine</div>
            <div class="f1-flagline off"><i class="dot"></i>has_primary_amine</div>
            <div class="f1-flagline on"><i class="dot"></i>has_secondary_amine</div>
            <span>배합 금기 규칙과 <b>강제분해 요청</b>이 함께 붙는다</span>
          </div>
        </div>`,
      note: `분자식을 읽지 못하면 <b>실행 전에 사유와 함께 되돌려 준다.</b> 구조를 못 얻은 채 실행되면
             규칙 게이트는 통과가 아니라 <b>사람 이관</b>을 낸다 — 작용기가 0개면 구조 기반 금기가
             하나도 발동하지 않고, 그 침묵을 합격으로 세면 게이트가 있으나 마나가 된다.`,
    },

    {
      nav: "검사 순서",
      kicker: "실행 순서",
      title: "앞 단계가 만든 값이 뒷 단계의 조건이 된다",
      lead: `가용화 전략은 <b>약이 얼마나 녹는지 판정된 뒤에야</b> 고를 수 있고, "직접타정 규칙"은
             <b>직접타정이 선택된 뒤에야</b> 의미가 있다. 그래서 단계마다 순서가 붙어 있고,
             <b>앞 단계가 만든 값이 뒷 단계의 발동 조건으로 흘러 들어간다.</b>`,
      art: `
        <div class="f1-stack f1-seq">
          <div class="f1-lvl"><span class="n">10</span><span>목표 고정 — 용량 · 대상 환자 · 보관 온도</span><span></span></div>
          <div class="f1-lvl"><span class="n">20</span><span>분자 프로파일 — 계산값 + ESOL/GSE</span><em>→ logs_pred_min</em></div>
          <div class="f1-lvl"><span class="n">25</span><span>실험 요청 ① — 전략을 좁히는 값</span><em>막지 않음</em></div>
          <div class="f1-lvl flow"><span class="n">30</span><span>BCS/DCS 판정</span><em>→ dcs_subclass</em></div>
          <div class="f1-lvl flow"><span class="n">35</span><span>고체상 판단 (권고만)</span><em>→ solid_form_zone</em></div>
          <div class="f1-lvl flow"><span class="n">40</span><span>가용화 신호</span><em>→ sig_enabling_required</em></div>
          <div class="f1-lvl flow"><span class="n">45</span><span>ASD 공정 — 녹는점 · 열안정성</span><em>→ HME / SDD</em></div>
          <div class="f1-lvl flow"><span class="n">48</span><span>공정 경로 — 안식각 48°</span><em>→ 직접타정 배제</em></div>
          <div class="f1-lvl"><span class="n">50</span><span>계획 — 전략 점수 → 상위 3개</span><span></span></div>
          <div class="f1-lvl"><span class="n">55</span><span>설계 (AI)</span><span></span></div>
          <div class="f1-lvl key"><span class="n">60</span><span>규칙 게이트 — 배합 금기 → 어린이 안전 → 공정 세부</span><em>반려는 여기서만</em></div>
          <div class="f1-lvl"><span class="n">65</span><span>실험 요청 ② — 후보별 신뢰도</span><span></span></div>
          <div class="f1-lvl"><span class="n">70</span><span>심사관 소집 → 심사(75) → 합의(80)</span><span></span></div>
          <div class="f1-lvl"><span class="n">90</span><span>후보 처방 목록</span><em>여기서 끝</em></div>
        </div>`,
      note: `투과도를 모르면 "녹는 속도가 문제(IIa)"인지 "녹는 양이 문제(IIb)"인지 가를 수 없고,
             두 경우의 해법은 정반대다. 이때 시스템은 한쪽으로 단정하지 않고
             <b>미분화와 가용화를 모두 후보로 열어 둔다.</b> 규칙 게이트 안에서는
             <b>어린이 안전이 배합 금기 바로 뒤</b>에서 돈다 — 성분 자체를 바꿔야 하는 반려라
             무거운 공정 계산 전에 먼저 걸러낸다.`,
    },

    {
      nav: "실험 요청 ★",
      kicker: "Lab-in-the-loop",
      title: "판정이 갈리는 곳에서만, 구체적인 시험을 묻는다",
      lead: `계산으로 알 수 없는 값이 판정을 가르는 지점에 오면, 시스템이
             <b>XRPD·DSC·평형용해도 같은 구체적인 시험</b>을 요청한다.
             요청할 수 있는 시험은 <b>측정 카탈로그 20종</b>뿐이고, 요청은 <b>실행을 막지 않는다.</b>`,
      art: `
        <div class="f1-arch f1-seq">
          <div class="f1-tier">
            <header><span>시료가 적게 드는 것부터</span><span>measurement_catalog.csv · 20종</span></header>
            <div class="f1-sub">
              <div class="f1-pill-sm"><b>Tier 1</b> ~10 mg · XRPD · DSC · TGA · 수분</div>
              <div class="f1-pill-sm"><b>Tier 2</b> ~30 mg · pKa · 평형용해도 · 투과도 · DVS</div>
              <div class="f1-pill-sm"><b>Tier 3</b> 20–300 mg · 강제분해 · 다형 · 유리형성능 · 유동성</div>
              <div class="f1-pill-sm dashed"><b>전략별</b> ASD · SEDDS · CD 실현성 · 염 스크리닝</div>
            </div>
          </div>
          <div class="f1-flowmark">▼ 언제 묻는가 — data_request_triggers.csv · 16행</div>
          <div class="f1-cols c2">
            <div class="f1-box f1-det"><b>① 전략을 좁히는 요청 · 계획 전</b>
              <span>결과에 따라 어느 전략을 고를지가 바뀐다.
                예: 녹는점 없이는 용융압출과 분무건조를 못 가른다</span></div>
            <div class="f1-box f1-det"><b>② 신뢰도를 높이는 요청 · 후보별</b>
              <span>이미 고른 전략의 신뢰도만 바뀐다.
                예: ASD 후보가 생긴 뒤의 고분자 혼화성</span></div>
          </div>
          <div class="f1-flowmark">▼</div>
          <div class="f1-cols c2">
            <div class="f1-box"><b>남은 요청 없음 ⟺ grounded</b>
              <span>계산값이지 판단이 아니다. AI가 신뢰도를 매길 여지가 없다</span></div>
            <div class="f1-box"><b>남은 요청 있음 ⟺ provisional</b>
              <span>"틀렸다"가 아니라 "이 실험을 하면 확정된다"</span></div>
          </div>
          <div class="f1-flowmark">▼ 측정값을 넣으면 — 계획 서명을 비교한다</div>
          <div class="f1-cols c2">
            <div class="f1-io">서명 같음 → 신뢰도·요청만 갱신 (LLM 0회)</div>
            <div class="f1-io">서명 다름 → 설계부터 다시</div>
          </div>
        </div>`,
      note: `건너뛰어도 멈추지 않는다 — 예측값으로 계속하고 <code class="f1-mono">provisional</code>을 남긴다.
             같은 시험을 가리키는 요청은 <b>하나로 합치고</b>, 이미 준 값은 <b>다시 묻지 않는다.</b>
             그리고 같은 용해도 요청이라도 <b>"예측이 낮아서"</b>와 <b>"두 예측이 1 log 이상 어긋나서"</b>는
             다른 확신 수준이라 화면에 다른 사유로 뜬다.`,
    },

    {
      nav: "실제로 이렇게 돌았다",
      kicker: "동작 예시",
      title: "아무 실측 없이 시작해서, 두 번의 요청으로 좁힌다",
      lead: `가상 화합물 <b>X1</b> — 용량 150 mg, cLogP 3.6, 분자량 412, 에스터 경고.
             그 외 실측값은 전혀 없다. 수치는 시드 규칙표로 프로토타입을 실제로 돌려 얻었다.`,
      art: `
        <div class="f1-story f1-seq">
          <div class="f1-beat"><div class="who">예측</div><div class="what"><div class="card">
            ESOL logS −4.59 (녹는점이 없어 GSE 불가)
            <span class="f1-mono">추정 용해도 0.0106 mg/mL → 용량을 녹이는 데 ≈ 14,150 mL (기준 250 mL)</span></div></div></div>

          <div class="f1-beat"><div class="who">판정</div><div class="what"><div class="card">
            잠정 저용해도 · 이온화기 없음 → 염 경로 닫힘
            <span class="f1-mono">IIa/IIb 미정 → 미분화와 가용화를 모두 연다</span></div></div></div>

          <div class="f1-beat fix"><div class="who">요청 ①</div><div class="what"><div class="card">
            <b>3건</b> — 녹는점(DSC) · 평형용해도 · 분체 유동성
            <span class="f1-mono">그래도 멈추지 않는다</span></div></div></div>

          <div class="f1-beat"><div class="who">계획·설계</div><div class="what"><div class="card">
            미분화(3.0) · 분무건조 ASD(2.0)
            <span class="f1-mono">두 후보 모두 provisional · 남은 확인: 강제분해 · 입도-용출 · 유리형성능 · ASD 실현성</span></div></div></div>

          <div class="f1-beat jud"><div class="who">사용자</div><div class="what"><div class="card">
            <b>Tier 1 세트 + 용해도 제출, 투과도는 건너뜀</b>
            <span class="f1-mono">Tm 234 °C · 무수물 · 열불안정 · 실측 용해도 0.021 mg/mL (FaSSIF 0.045)</span></div></div></div>

          <div class="f1-beat"><div class="who">재계산</div><div class="what"><div class="card">
            GSE logS −5.19 → 예측 0.0027 mg/mL — <b>실측보다 8배 낮게 예측했다</b>
            <span class="f1-mono">고융점·열불안정 확정 → 분무건조가 근거 있는 선택으로 격상</span>
            <span class="f1-mono">Tg 여유 40 K (기준 50 K 미달 → 배제 아님, 감점)</span></div></div></div>

          <div class="f1-beat win"><div class="who">결과</div><div class="what"><div class="card">
            <b>요청 3건 → 2건</b> (투과도 · 유동성)
            <span class="f1-mono">미분화(3.0) · 분무건조 ASD(2.0 → 3.0)</span></div></div></div>
        </div>
        <div class="f1-cols c2 f1-seq" style="margin-top:14px">
          <div class="f1-box"><b>X2 — 예측끼리 싸울 때</b>
            <span>ESOL만 보면 용해도 <b>충분</b>(211 mL), 녹는점 290 °C를 반영한 GSE로는 <b>낮음</b>(2,868 mL).
              녹는점 하나가 결론을 뒤집는다 → 보수적 값을 쓰고 용해도 측정을 요청</span></div>
          <div class="f1-box f1-fail"><b>X3 — 구조만으로 끝날 때</b>
            <span>2차 아민 + 아질산염 함유 가능 부형제 → 니트로사민 위험으로 반려.
              <b>요청 0건</b> — 더 재도 결론이 안 바뀐다</span></div>
        </div>`,
      note: `두 가지를 눈여겨볼 만하다. <b>예측과 실측이 공존한다</b> — 예측이 8배 낮았다는 사실 자체가
             이 계열 화합물의 보정 정보로 남는다. 그리고 <b>투과도를 건너뛰어도 멈추지 않는다</b> —
             미정인 채로 두 방향을 모두 살려 둔다. 반대로 X3처럼 구조가 이미 결정적이면
             규칙표가 그 자리에서 끝낸다. lab-in-the-loop은 "항상 많이 묻는 시스템"이 아니다.`,
    },

    {
      nav: "근거 없는 규칙은 안 돈다",
      kicker: "차별점",
      title: "출처를 못 찾은 규칙은, 실행되지 않는다",
      lead: `규칙표 · 파생값 식 · 전략 · 실험 요청의 각 줄에는 그 수치를 <b>어디서 가져왔는지</b>가 함께 적혀 있다.
             약대생 팀이 하나하나 출처를 추적해 붙였고, 추적에 실패한 것은 실패했다고 정직하게 기록했다.
             엔진은 그 기록(<code class="f1-mono">verification_status</code>)을 읽고 스스로 판단한다.`,
      art: `
        <div class="f1-policy f1-seq">
          <div class="f1-prow use"><span class="st">VERIFIED / _PRIMARY / _SECONDARY</span>
            <span class="to">→</span><span class="act">그대로 판정에 사용 — 반려를 만들 수 있다</span></div>
          <div class="f1-prow prov"><span class="st">PROVISIONAL / STRUCTURAL_VERIFIED</span>
            <span class="to">→</span><span class="act">사용하되 결과에 "잠정값" 표기</span></div>
          <div class="f1-prow down"><span class="st">UNVERIFIED / SCHEMA_ONLY</span>
            <span class="to">→</span><span class="act"><b>반려는 못 시킴</b> — 심사관 이관으로 강등</span></div>
          <div class="f1-prow esc"><span class="st">ESCALATION_REQUIRED</span>
            <span class="to">→</span><span class="act">사람에게 이관</span></div>
          <div class="f1-prow drop"><span class="st">NO_SOURCE_FOUND / NOT_A_RULE / LEGACY</span>
            <span class="to">→</span><span class="act"><b>로딩 단계에서 아예 제외</b> — 메모리에 올라오지도 않는다</span></div>
        </div>
        <div class="guide-note warn" style="margin-top:16px">
          <b>원문을 대조하다 고친 값도 있다.</b><br>
          염/공결정 경계의 ΔpKa 기준은 흔히 인용되는 "±3"이 아니라 원문(Cruz-Cabeza 2012)의
          <b>−1 / 4</b>이고, Tg 여유의 원래 기준은 약물 단독 Tg가 아니라 <b>고분자와 섞은 뒤의 Tg</b>(Hancock 1994)다.
          초기 데모의 반려 사유였던 "소아 SLS 10mg 초과"도 출처를 추적해 보니 <b>경피 투여 전용</b> 기준이라
          <code class="f1-mono">NO_SOURCE_FOUND / NOT_A_RULE</code>로 폐기됐다.
          <b>근거가 없는 판정은 하지 않는다는 원칙이 우리 편의보다 먼저 적용된 셈이고, 그것이 이 프로젝트가
          팔려는 바로 그 가치다.</b>
        </div>`,
      note: `규제 기관을 설득해야 하는 분야에서는 "그럴듯한 규칙이 많은 것"보다
             <b>"근거 없는 규칙은 안 돌린다"</b>가 훨씬 중요한 자산이라고 판단했다.
             새로 추가한 측정 카탈로그·실험 요청·짝이온 pKa 표도 모든 행이 약학 팀 검수 대기 상태로 표시돼 있다.`,
    },
  ];

  /* 마지막 단계 끝에 붙는 실행 유도 — 설명이 끝나면 바로 화면을 쓰게 만든다. */
  const CTA = `
    <div class="f1-cta">
      <p><b>이제 직접 돌려 보세요.</b> 분자식과 용량만 넣으면 됩니다. 오른쪽 <b>실험 요청 카드</b>에
        값을 넣거나 건너뛰면 후보가 좁혀지고, 후보 카드의 <b>grounded / provisional</b> 배지가 바뀝니다.<br>
        트레이스의 규칙 발동을 클릭하면 <b>원본 CSV 행과 출처 문헌</b>이 열립니다.</p>
      <button type="button" id="guide-finish">설명 닫고 실행하기 →</button>
    </div>`;

  /* ── 렌더링 ─────────────────────────────────────────────────────── */
  const el = (id) => document.getElementById(id);
  let index = 0;
  const visited = new Set();

  function buildRail() {
    el("guide-count").textContent = `${STEPS.length}단계 · 약 5분`;
    el("guide-nav").innerHTML = STEPS.map((s, i) => `<li data-i="${i}">${s.nav}</li>`).join("");
    el("guide-dots").innerHTML = STEPS.map((_, i) => `<i data-i="${i}"></i>`).join("");
    document.querySelectorAll("#guide-nav li, #guide-dots i").forEach((node) => {
      node.onclick = () => show(Number(node.dataset.i));
    });
  }

  function show(i) {
    index = Math.max(0, Math.min(STEPS.length - 1, i));
    visited.add(index);
    const step = STEPS[index];

    el("guide-body").innerHTML = `
      <div class="guide-kicker">${step.kicker}</div>
      <h2>${step.title}</h2>
      <p class="guide-lead">${step.lead}</p>
      <div class="guide-art">${step.art}</div>
      ${step.note ? `<div class="guide-note">${step.note}</div>` : ""}
      ${index === STEPS.length - 1 ? CTA : ""}`;
    el("guide-body").scrollTop = 0;

    // 그림 요소를 순서대로 등장시켜 "흐름"이 눈으로 따라가지게 한다.
    el("guide-body").querySelectorAll(".f1-seq").forEach((group) => {
      [...group.children].forEach((child, n) => {
        child.style.animationDelay = `${60 + n * 70}ms`;
      });
    });

    document.querySelectorAll("#guide-nav li").forEach((li, n) => {
      li.classList.toggle("on", n === index);
      li.classList.toggle("seen", n !== index && visited.has(n));
    });
    document.querySelectorAll("#guide-dots i").forEach((dot, n) => {
      dot.classList.toggle("on", n === index);
    });

    el("guide-prev").disabled = index === 0;
    el("guide-next").textContent = index === STEPS.length - 1 ? "닫기 ✓" : "다음 →";

    const finish = el("guide-finish");
    if (finish) finish.onclick = close;
  }

  let lastFocus = null;

  function open(startAt) {
    lastFocus = document.activeElement;
    el("guide").hidden = false;
    document.body.style.overflow = "hidden";
    show(typeof startAt === "number" ? startAt : 0);
    // 스크린리더·키보드 사용자가 오버레이 안에서 시작하도록 포커스를 옮긴다.
    el("guide-next").focus();
  }

  function close() {
    el("guide").hidden = true;
    document.body.style.overflow = "";
    try { localStorage.setItem(SEEN_KEY, "1"); } catch (e) { /* 사생활 모드 등 — 무시 */ }
    // 열기 버튼으로 포커스를 되돌린다(안 그러면 body로 떨어져 탭 순서가 끊긴다).
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    else el("guide-open").focus();
    lastFocus = null;
  }

  /* 모달 안에서 Tab이 배경으로 새지 않게 가둔다. */
  function trapFocus(e) {
    const focusable = el("guide").querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  buildRail();
  el("guide-open").onclick = () => open(0);
  el("guide-close").onclick = close;
  el("guide-close-rail").onclick = close;
  el("guide-prev").onclick = () => show(index - 1);
  el("guide-next").onclick = () => (index === STEPS.length - 1 ? close() : show(index + 1));
  el("guide").onclick = (e) => { if (e.target.id === "guide") close(); };

  document.addEventListener("keydown", (e) => {
    if (el("guide").hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") show(index + 1);
    else if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "Tab") trapFocus(e);
  });

  // ?guide=4 처럼 특정 단계를 바로 열 수 있다 — 설명 한 대목만 공유할 때 쓴다.
  const requested = new URLSearchParams(location.search).get("guide");
  if (requested !== null) {
    open(Math.max(0, Number(requested) - 1) || 0);
    return;
  }

  // 첫 방문이면 자동으로 띄운다 — 처음 온 사람은 이 시스템이 뭔지 모른다.
  let seen = false;
  try { seen = localStorage.getItem(SEEN_KEY) === "1"; } catch (e) { seen = false; }
  if (!seen) open(0);
})();
